import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CreateSubsystemDto } from './dto/create-subsystem.dto';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { PrismaService } from 'src/database/prisma.service';
import { UpdateSubsystemDto } from './dto/update-subsystem.dto';
import { UpdateRoleMappingDto } from './dto/update-role-mapping.dto';
import {
  ListExceptionsQuery,
  ListSubsystemsQuery,
} from './dto/list-subsystems.query';
import {
  Prisma,
  Subsystem,
  SubsystemEventAction,
  SubsystemStatus,
} from '../../../generated/prisma/client';
import { Permission } from '../authorization/permission.enum';
import { roleHasPermission } from '../authorization/role-permissions';
import { Paginated } from 'src/common/pagination/paginated';
import { effectiveRole, mappedCoreRoles } from './subsystem-access';
import { StandardsVersionsService } from './standards-versions.service';
import { isRoleMapping } from './dto/role-mapping.validator';
import {
  CreateChangeRequestDto,
  ListChangeRequestsQuery,
} from './dto/change-request.dto';

/** Who is acting — the subset of the authenticated user the rules need. */
export interface SubsystemActor {
  id: string;
  role: string;
}

/**
 * Fields that decide who may enter a subsystem and where Core Hub redirects
 * them. Once a subsystem is approved, only `subsystem:update:any` may change
 * them — otherwise an owner could point an approved system at another host or
 * open it to new roles without a review.
 */
const REVIEWED_FIELDS = [
  'name',
  'callbackUrl',
  'baseUrl',
  'defaultRoleMapping',
] as const;

/**
 * The reviewed fields an owner changes through a change request (PM
 * 2026-10-05, handoff 2.2). `name` is not one of them: it is the `azp` in
 * every token, so only an administrator renames a subsystem (2.3).
 */
export const CHANGE_REQUEST_FIELDS = [
  'callbackUrl',
  'baseUrl',
  'defaultRoleMapping',
] as const;

/** New values of a change request, as stored in `changes`. */
type RequestedValues = Partial<{
  callbackUrl: string;
  baseUrl: string | null;
  defaultRoleMapping: Record<string, string>;
}>;

/** Fields whose before/after values the history records. */
const HISTORY_FIELDS = [
  'name',
  'displayName',
  'category',
  'description',
  'listedInMenu',
  'repo',
  'standardsVersion',
  'callbackUrl',
  'baseUrl',
  'defaultRoleMapping',
] as const;

/** `{ "<field>": { "from": …, "to": … } }` — only what changed (handoff 2.5). */
export type FieldChanges = Record<
  string,
  { from: Prisma.JsonValue; to: Prisma.JsonValue }
>;

/**
 * Before/after values of the history fields set in `next` that differ from
 * `current`. Undefined in `next` means "not sent", so it is left out.
 */
export function fieldChanges(
  current: Partial<Record<string, unknown>>,
  next: Partial<Record<string, unknown>>,
): FieldChanges {
  const changes: FieldChanges = {};
  for (const field of HISTORY_FIELDS) {
    const to = next[field];
    if (to === undefined) continue;
    const from = current[field] ?? null;
    const same =
      field === 'defaultRoleMapping'
        ? canonicalMapping(from) === canonicalMapping(to)
        : from === to;
    if (!same) {
      changes[field] = {
        from: from,
        to: to,
      };
    }
  }
  return changes;
}

/** Serialization failure — another transaction raced this one (P2034). */
function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2034'
  );
}

/** URL fields that must follow the registration transport rule. */
export type RegistrableUrlField = 'callbackUrl' | 'baseUrl';

const PERSON = { select: { id: true, username: true, email: true } } as const;

const CHANGE_REQUEST_INCLUDE = {
  requestedBy: PERSON,
  reviewedBy: PERSON,
} as const;

const PENDING_REQUEST_TAKEN =
  'This subsystem already has a pending change request — wait for the review or cancel it first';

/** A cleared text field is stored as null, not as an empty string. */
function emptyToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Stable JSON for comparing role mappings regardless of key order. */
function canonicalMapping(value: unknown): string {
  const entries = Object.entries((value ?? {}) as Record<string, unknown>);
  return JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Fields in `dto` whose value differs from what is stored — an edit form that
 * sends every field back unchanged must not trip the reviewed-field rule.
 * (`owner` is a username and is checked on its own in `update()`.)
 */
function changedFields(
  subsystem: Subsystem,
  dto: Omit<UpdateSubsystemDto, 'baseUrl'> & { baseUrl?: string | null },
): string[] {
  return Object.entries(dto)
    .filter(([field, value]) => {
      if (value === undefined) return false;
      if (field === 'defaultRoleMapping') {
        return (
          canonicalMapping(value) !==
          canonicalMapping(subsystem.defaultRoleMapping)
        );
      }
      if (field in subsystem) {
        return subsystem[field as keyof Subsystem] !== value;
      }
      return true;
    })
    .map(([field]) => field);
}

@Injectable()
export class SubsystemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly standardsVersions: StandardsVersionsService,
  ) {}

  /**
   * 400 VALIDATION_ERROR unless `version` is a released standards version
   * (handoff 2.7). A stored value that is no longer in the list (e.g. `1.0`)
   * may be saved again unchanged — `current` is that stored value.
   */
  private async assertStandardsVersion(
    version: string,
    current?: string,
  ): Promise<void> {
    if (current !== undefined && version === current) return;
    if (await this.standardsVersions.isKnown(version)) return;

    const { versions } = await this.standardsVersions.list();
    throw new BadRequestException([
      versions.length > 0
        ? `standardsVersion must be a released csmju2030-standards version (e.g. ${versions[0]}) — see GET /api/v1/subsystems/standards-versions`
        : 'standardsVersion cannot be checked right now: the list of standards versions is unavailable',
    ]);
  }

  /** 400 when `rawUrl` fails the transport rule of `registrableUrlProblem`. */
  private assertRegistrableUrl(
    field: RegistrableUrlField,
    rawUrl: string,
  ): void {
    const problem = this.registrableUrlProblem(field, rawUrl);

    if (problem) {
      throw new BadRequestException(problem);
    }
  }

  /**
   * Why `rawUrl` may not be registered, or used as an SSO redirect target,
   * right now — or null when it may. The one place the transport rule lives:
   * registration refuses with 400, and `SsoService.authorize` refuses a
   * stored callback that no longer passes (409), so switching
   * ALLOW_LOCALHOST_CALLBACKS off closes every http://localhost callback at
   * once, without deactivating each subsystem.
   *
   *   NODE_ENV       ALLOW_LOCALHOST_CALLBACKS   http://localhost   http://other   https://
   *   not production (ignored)                   yes                no             yes
   *   production     unset / anything but true   no                 no             yes
   *   production     true                        yes                no             yes
   */
  registrableUrlProblem(
    field: RegistrableUrlField,
    rawUrl: string,
  ): string | null {
    let url: URL;

    try {
      url = new URL(rawUrl.trim());
    } catch {
      return `${field} must be an absolute URL`;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return `${field} must use http or https`;
    }

    if (url.protocol === 'https:') {
      return null;
    }

    const isLocalHost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(
      url.hostname,
    );
    const isProduction =
      this.config.get<string>('app.environment') === 'production';
    const localhostAllowed =
      !isProduction ||
      this.config.get<boolean>('app.allowLocalhostCallbacks', false) === true;

    if (!isLocalHost || !localhostAllowed) {
      return `${field} must use HTTPS (plain http is only allowed for localhost during development or while ALLOW_LOCALHOST_CALLBACKS is on)`;
    }

    return null;
  }

  /**
   * `baseUrl` is optional: `undefined` leaves it alone, an empty string
   * clears it (stored as null), anything else must pass the transport rule.
   */
  private normaliseBaseUrl(raw: string | undefined): string | null | undefined {
    if (raw === undefined) return undefined;
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    this.assertRegistrableUrl('baseUrl', trimmed);
    return trimmed;
  }

  /**
   * Exception requests (2.5): the role must be a key of the subsystem's role
   * mapping (the DTO already limits it to the six core roles) and the
   * username must belong to a real account. 400 VALIDATION_ERROR otherwise —
   * thrown with a message array so the filter reports it as validation.
   */
  private async assertValidExceptions(
    mapping: unknown,
    requests: readonly { username: string; role: string }[],
  ): Promise<void> {
    if (requests.length === 0) return;

    const problems: string[] = [];
    const mapped = mappedCoreRoles(mapping);

    for (const request of requests) {
      if (!mapped.includes(request.role)) {
        problems.push(
          `role ${request.role} is not in this subsystem's role mapping`,
        );
      }
    }

    const usernames = [...new Set(requests.map((r) => r.username))];
    const found = await this.prisma.user.findMany({
      where: { username: { in: usernames } },
      select: { username: true },
    });
    const known = new Set(found.map((user) => user.username));

    for (const username of usernames) {
      if (!known.has(username)) {
        problems.push(`username ${username} does not exist`);
      }
    }

    if (problems.length > 0) {
      throw new BadRequestException(problems);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Ownership (authorization.md §4 — `:own` is checked on real data)  */
  /* ---------------------------------------------------------------- */

  private can(actor: SubsystemActor, permission: Permission): boolean {
    return roleHasPermission(actor.role, permission);
  }

  private isOwner(
    subsystem: Pick<Subsystem, 'ownerId'>,
    actor: SubsystemActor,
  ) {
    return subsystem.ownerId === actor.id;
  }

  private assertCanRead(
    subsystem: Pick<Subsystem, 'ownerId'>,
    actor: SubsystemActor,
  ): void {
    if (this.can(actor, Permission.SUBSYSTEM_READ_ANY)) return;
    if (
      this.isOwner(subsystem, actor) &&
      this.can(actor, Permission.SUBSYSTEM_READ_OWN)
    ) {
      return;
    }
    throw new ForbiddenException('You do not have access to this subsystem');
  }

  private assertCanEdit(
    subsystem: Pick<Subsystem, 'ownerId'>,
    actor: SubsystemActor,
  ): void {
    if (this.can(actor, Permission.SUBSYSTEM_UPDATE_ANY)) return;
    if (
      this.isOwner(subsystem, actor) &&
      this.can(actor, Permission.SUBSYSTEM_UPDATE_OWN)
    ) {
      return;
    }
    throw new ForbiddenException('You cannot change this subsystem');
  }

  /**
   * Hiding a subsystem from everyone's menu is a platform decision — the
   * owner chooses its category and description, not whether users see it.
   */
  private assertCanSetListing(
    dto: { listedInMenu?: boolean },
    actor: SubsystemActor,
  ): void {
    if (
      dto.listedInMenu !== undefined &&
      !this.can(actor, Permission.SUBSYSTEM_UPDATE_ANY)
    ) {
      throw new ForbiddenException(
        'Only an administrator can hide a subsystem from the menu',
      );
    }
  }

  private assertCanChangeReviewedFields(
    subsystem: Pick<Subsystem, 'id' | 'approvalStatus'>,
    changed: readonly string[],
    actor: SubsystemActor,
  ): void {
    if (subsystem.approvalStatus !== 'APPROVED') return;
    if (this.can(actor, Permission.SUBSYSTEM_UPDATE_ANY)) return;

    const locked = changed.filter((field) =>
      (REVIEWED_FIELDS as readonly string[]).includes(field),
    );
    const requestable = locked.filter((field) =>
      (CHANGE_REQUEST_FIELDS as readonly string[]).includes(field),
    );

    if (requestable.length > 0) {
      throw new ForbiddenException(
        `An approved subsystem's ${requestable.join(', ')} cannot be changed directly — submit a change request (POST /api/v1/subsystems/${subsystem.id}/change-requests) for an administrator to approve`,
      );
    }

    if (locked.length > 0) {
      throw new ForbiddenException(
        "An approved subsystem's name can only be changed by an administrator (it is the azp of every token)",
      );
    }
  }

  private async findOrThrow(id: string): Promise<Subsystem> {
    const subsystem = await this.prisma.subsystem.findUnique({
      where: { id },
    });

    if (!subsystem) {
      throw new NotFoundException('Subsystem not found');
    }

    return subsystem;
  }

  private event(
    actor: SubsystemActor,
    action: SubsystemEventAction,
    reason?: string | null,
    changes?: FieldChanges,
  ) {
    return {
      events: {
        create: {
          actorId: actor.id,
          action,
          reason,
          ...(changes &&
            Object.keys(changes).length > 0 && {
              changes: changes as Prisma.InputJsonValue,
            }),
        },
      },
    };
  }

  /* ---------------------------------------------------------------- */
  /* Registration                                                      */
  /* ---------------------------------------------------------------- */

  async create(dto: CreateSubsystemDto, actor: SubsystemActor) {
    this.assertRegistrableUrl('callbackUrl', dto.callbackUrl);
    this.assertCanSetListing(dto, actor);
    const baseUrl = this.normaliseBaseUrl(dto.baseUrl) ?? null;
    await this.assertStandardsVersion(dto.standardsVersion);

    const existingSubsystem = await this.prisma.subsystem.findUnique({
      where: {
        name: dto.name,
      },
    });

    if (existingSubsystem) {
      throw new ConflictException('Subsystem name already exists');
    }

    await this.assertValidExceptions(
      dto.defaultRoleMapping,
      dto.requestedExceptions ?? [],
    );

    let ownerId = actor.id;

    if (dto.owner !== undefined) {
      const owner = await this.prisma.user.findUnique({
        where: {
          username: dto.owner,
        },
      });

      if (!owner) {
        throw new NotFoundException('Subsystem owner not found');
      }

      if (
        owner.id !== actor.id &&
        !this.can(actor, Permission.SUBSYSTEM_UPDATE_ANY)
      ) {
        throw new ForbiddenException(
          'You can only register a subsystem under your own account',
        );
      }

      ownerId = owner.id;
    }

    const subsystem = await this.prisma.subsystem.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        category: dto.category,
        description: emptyToNull(dto.description),
        listedInMenu: dto.listedInMenu,
        ownerId,
        repo: dto.repo,
        standardsVersion: dto.standardsVersion,
        defaultRoleMapping: dto.defaultRoleMapping,
        callbackUrl: dto.callbackUrl,
        baseUrl,
        exceptions: {
          create: (dto.requestedExceptions ?? []).map((exception) => ({
            username: exception.username,
            role: exception.role,
            reason: exception.reason,
          })),
        },
        ...this.event(actor, SubsystemEventAction.SUBMITTED),
      },
      include: {
        exceptions: true,
      },
    });

    return subsystem;
  }

  /**
   * The whole registry, unpaginated. Kept in its original shape because the
   * conformance suite reads it (`L3-01..05`) — the backoffice uses `list()`.
   */
  async findAll() {
    return this.prisma.subsystem.findMany({
      include: {
        exceptions: true,
      },
    });
  }

  /** Backoffice list — staff see only their own subsystems. */
  async list(query: ListSubsystemsQuery, actor: SubsystemActor) {
    const where: Prisma.SubsystemWhereInput = {
      approvalStatus: query.approvalStatus,
      status: query.status,
      ...(this.can(actor, Permission.SUBSYSTEM_READ_ANY)
        ? {}
        : { ownerId: actor.id }),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { displayName: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subsystem.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { owner: PERSON },
      }),
      this.prisma.subsystem.count({ where }),
    ]);

    return Paginated.of(items, total, query.page, query.limit);
  }

  /** Counts for the backoffice summary cards, scoped like `list()`. */
  async summary(actor: SubsystemActor) {
    const scope: Prisma.SubsystemWhereInput = this.can(
      actor,
      Permission.SUBSYSTEM_READ_ANY,
    )
      ? {}
      : { ownerId: actor.id };

    const count = (where: Prisma.SubsystemWhereInput) =>
      this.prisma.subsystem.count({ where: { ...scope, ...where } });

    const [total, pending, rejected, active, inactive, suspended] =
      await this.prisma.$transaction([
        count({}),
        count({ approvalStatus: 'PENDING' }),
        count({ approvalStatus: 'REJECTED' }),
        count({ approvalStatus: 'APPROVED', status: 'ACTIVE' }),
        count({ approvalStatus: 'APPROVED', status: 'INACTIVE' }),
        count({ approvalStatus: 'APPROVED', status: 'SUSPENDED' }),
      ]);

    const pendingExceptions = this.can(actor, Permission.SUBSYSTEM_REVIEW)
      ? await this.prisma.subsystemException.count({
          where: { status: 'REQUESTED' },
        })
      : 0;
    const pendingChangeRequests = this.can(actor, Permission.SUBSYSTEM_REVIEW)
      ? await this.prisma.subsystemChangeRequest.count({
          where: { status: 'PENDING' },
        })
      : 0;

    return {
      total,
      pending,
      rejected,
      active,
      inactive,
      suspended,
      pendingExceptions,
      pendingChangeRequests,
    };
  }

  /**
   * Live subsystems the caller may enter through SSO — just enough for the
   * portal's "ระบบย่อย" menu, without owners or exception requests. Uses the
   * same effective role and lower-case key comparison as SsoService, so an
   * approved exception shows its subsystem here too.
   */
  async directory(user: { role: string; username?: string | null }) {
    const live = await this.prisma.subsystem.findMany({
      where: {
        approvalStatus: 'APPROVED',
        status: 'ACTIVE',
        listedInMenu: true,
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        displayName: true,
        category: true,
        description: true,
        defaultRoleMapping: true,
        exceptions: user.username
          ? {
              where: { status: 'APPROVED', username: user.username },
              select: {
                username: true,
                role: true,
                status: true,
                updatedAt: true,
              },
            }
          : false,
      },
    });

    return live
      .filter((subsystem) =>
        mappedCoreRoles(subsystem.defaultRoleMapping).includes(
          effectiveRole(subsystem.exceptions, user).role,
        ),
      )
      .map(
        ({
          id,
          name,
          displayName,
          category,
          description,
          defaultRoleMapping,
        }) => ({
          id,
          name,
          displayName,
          category,
          description,
          defaultRoleMapping,
        }),
      );
  }

  /** One subsystem with everything the detail page shows. */
  async findOne(id: string, actor: SubsystemActor) {
    const subsystem = await this.prisma.subsystem.findUnique({
      where: { id },
      include: {
        owner: PERSON,
        reviewedBy: PERSON,
        exceptions: { orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] },
        events: {
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          include: { actor: PERSON },
        },
      },
    });

    if (!subsystem) {
      throw new NotFoundException('Subsystem not found');
    }

    this.assertCanRead(subsystem, actor);

    const pendingChangeRequest =
      await this.prisma.subsystemChangeRequest.findFirst({
        where: { subsystemId: id, status: 'PENDING' },
        include: CHANGE_REQUEST_INCLUDE,
      });

    return { ...subsystem, pendingChangeRequest };
  }

  /**
   * Looks a subsystem up by its id, falling back to its unique name.
   * Used by the central SSO flow, where a client may refer to a subsystem
   * either way (for example: `student-service`).
   */
  async findByIdentifier(identifier: string) {
    const subsystem = await this.prisma.subsystem.findFirst({
      where: {
        OR: [{ id: identifier }, { name: identifier }],
      },
      include: {
        exceptions: true,
      },
    });

    if (!subsystem) {
      throw new NotFoundException('Subsystem not found');
    }

    return subsystem;
  }

  async update(id: string, dto: UpdateSubsystemDto, actor: SubsystemActor) {
    // PartialType's IsOptional lets null through the DTO; a mapping cannot be
    // cleared (the column is required and SSO would let nobody in).
    if ((dto.defaultRoleMapping as unknown) === null) {
      throw new BadRequestException([
        'defaultRoleMapping cannot be null — send a mapping with at least one core role',
      ]);
    }

    if (dto.callbackUrl !== undefined) {
      this.assertRegistrableUrl('callbackUrl', dto.callbackUrl);
    }
    const baseUrl = this.normaliseBaseUrl(dto.baseUrl);

    const subsystem = await this.findOrThrow(id);

    this.assertCanEdit(subsystem, actor);
    this.assertCanSetListing(dto, actor);

    if (dto.standardsVersion !== undefined) {
      await this.assertStandardsVersion(
        dto.standardsVersion,
        subsystem.standardsVersion,
      );
    }

    this.assertCanChangeReviewedFields(
      subsystem,
      changedFields(subsystem, {
        ...dto,
        // Compare the stored form (null when cleared), not the raw string.
        ...(baseUrl !== undefined && { baseUrl }),
      }),
      actor,
    );

    let ownerId: string | undefined;

    if (dto.owner !== undefined) {
      const owner = await this.prisma.user.findUnique({
        where: {
          username: dto.owner,
        },
      });

      if (!owner) {
        throw new NotFoundException('Subsystem owner not found');
      }

      if (
        owner.id !== subsystem.ownerId &&
        !this.can(actor, Permission.SUBSYSTEM_UPDATE_ANY)
      ) {
        throw new ForbiddenException(
          'Only an administrator can hand a subsystem to someone else',
        );
      }

      ownerId = owner.id;
    }

    // Compare the stored forms: a cleared description and baseUrl are null.
    const changes = fieldChanges(subsystem, {
      ...dto,
      ...(baseUrl !== undefined && { baseUrl }),
      ...(dto.description !== undefined && {
        description: emptyToNull(dto.description),
      }),
    });

    if (ownerId !== undefined && ownerId !== subsystem.ownerId) {
      const previous = await this.prisma.user.findUnique({
        where: { id: subsystem.ownerId },
        select: { username: true },
      });
      changes.owner = {
        from: previous?.username ?? null,
        to: dto.owner ?? null,
      };
    }

    if (dto.name !== undefined && dto.name !== subsystem.name) {
      const taken = await this.prisma.subsystem.findUnique({
        where: { name: dto.name },
      });

      if (taken) {
        throw new ConflictException('Subsystem name already exists');
      }
    }

    return this.prisma.subsystem.update({
      where: { id },
      data: {
        name: dto.name,
        displayName: dto.displayName,
        category: dto.category,
        ...(dto.description !== undefined && {
          description: emptyToNull(dto.description),
        }),
        listedInMenu: dto.listedInMenu,
        repo: dto.repo,
        standardsVersion: dto.standardsVersion,
        defaultRoleMapping: dto.defaultRoleMapping,
        callbackUrl: dto.callbackUrl,
        ...(baseUrl !== undefined && { baseUrl }),

        ...(ownerId !== undefined && {
          ownerId,
        }),
        ...this.event(actor, SubsystemEventAction.UPDATED, null, changes),
      },
      include: {
        exceptions: true,
      },
    });
  }

  async delete(id: string) {
    const subsystem = await this.findOrThrow(id);

    if (subsystem.status === SubsystemStatus.ACTIVE) {
      throw new ConflictException(
        'Deactivate the subsystem before deleting it',
      );
    }

    await this.prisma.subsystem.delete({
      where: { id },
    });

    return { id, deleted: true };
  }

  /* ---------------------------------------------------------------- */
  /* Review                                                            */
  /* ---------------------------------------------------------------- */

  async approve(id: string, actor: SubsystemActor) {
    const subsystem = await this.findOrThrow(id);

    if (subsystem.approvalStatus !== 'PENDING') {
      throw new ConflictException(
        `Subsystem cannot be approved from status ${subsystem.approvalStatus}`,
      );
    }

    return this.prisma.subsystem.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        reviewedById: actor.id,
        reviewedAt: new Date(),
        rejectionReason: null,
        ...this.event(actor, SubsystemEventAction.APPROVED),
      },
      include: {
        exceptions: true,
      },
    });
  }

  async reject(id: string, reason: string, actor: SubsystemActor) {
    const subsystem = await this.findOrThrow(id);

    if (subsystem.approvalStatus !== 'PENDING') {
      throw new ConflictException(
        `Subsystem cannot be rejected from status ${subsystem.approvalStatus}`,
      );
    }

    return this.prisma.subsystem.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        reviewedById: actor.id,
        reviewedAt: new Date(),
        rejectionReason: reason,
        ...this.event(actor, SubsystemEventAction.REJECTED, reason),
      },
      include: {
        exceptions: true,
      },
    });
  }

  /** The owner fixed what was rejected and asks for another review. */
  async resubmit(id: string, actor: SubsystemActor) {
    const subsystem = await this.findOrThrow(id);

    this.assertCanEdit(subsystem, actor);

    if (subsystem.approvalStatus !== 'REJECTED') {
      throw new ConflictException(
        `Only a rejected subsystem can be resubmitted (approvalStatus: ${subsystem.approvalStatus})`,
      );
    }

    return this.prisma.subsystem.update({
      where: { id },
      data: {
        approvalStatus: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
        ...this.event(actor, SubsystemEventAction.RESUBMITTED),
      },
      include: {
        exceptions: true,
      },
    });
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  async activate(id: string, actor: SubsystemActor) {
    const subsystem = await this.findOrThrow(id);

    if (subsystem.approvalStatus !== 'APPROVED') {
      throw new ConflictException(
        'Subsystem must be approved before activation',
      );
    }

    if (subsystem.status === SubsystemStatus.ACTIVE) {
      throw new ConflictException('Subsystem is already active');
    }

    return this.prisma.subsystem.update({
      where: { id },
      data: {
        status: SubsystemStatus.ACTIVE,
        statusReason: null,
        ...this.event(actor, SubsystemEventAction.ACTIVATED),
      },
      include: {
        exceptions: true,
      },
    });
  }

  async deactivate(
    id: string,
    reason: string | undefined,
    actor: SubsystemActor,
  ) {
    const subsystem = await this.findOrThrow(id);

    if (subsystem.status !== SubsystemStatus.ACTIVE) {
      throw new ConflictException(
        'Only an active subsystem can be deactivated',
      );
    }

    return this.prisma.subsystem.update({
      where: { id },
      data: {
        status: SubsystemStatus.INACTIVE,
        statusReason: reason ?? null,
        ...this.event(actor, SubsystemEventAction.DEACTIVATED, reason),
      },
      include: {
        exceptions: true,
      },
    });
  }

  async suspend(id: string, reason: string, actor: SubsystemActor) {
    const subsystem = await this.findOrThrow(id);

    if (subsystem.status !== SubsystemStatus.ACTIVE) {
      throw new ConflictException('Only an active subsystem can be suspended');
    }

    return this.prisma.subsystem.update({
      where: { id },
      data: {
        status: SubsystemStatus.SUSPENDED,
        statusReason: reason,
        ...this.event(actor, SubsystemEventAction.SUSPENDED, reason),
      },
      include: {
        exceptions: true,
      },
    });
  }

  /* ---------------------------------------------------------------- */
  /* Role mapping                                                      */
  /* ---------------------------------------------------------------- */

  async getRoleMapping(id: string, actor: SubsystemActor) {
    const subsystem = await this.prisma.subsystem.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ownerId: true,
        defaultRoleMapping: true,
      },
    });

    if (!subsystem) {
      throw new NotFoundException('Subsystem not found');
    }

    this.assertCanRead(subsystem, actor);

    return {
      id: subsystem.id,
      name: subsystem.name,
      defaultRoleMapping: subsystem.defaultRoleMapping,
    };
  }

  async updateRoleMapping(
    id: string,
    dto: UpdateRoleMappingDto,
    actor: SubsystemActor,
  ) {
    const subsystem = await this.findOrThrow(id);

    this.assertCanEdit(subsystem, actor);
    this.assertCanChangeReviewedFields(
      subsystem,
      ['defaultRoleMapping'],
      actor,
    );

    // Shape (non-empty, core-role keys, non-empty values) is checked by
    // UpdateRoleMappingDto, so a bad mapping is a 400 before this runs.
    const mapping = dto.defaultRoleMapping;

    return this.prisma.subsystem.update({
      where: { id },
      data: {
        defaultRoleMapping: mapping,
        ...this.event(
          actor,
          SubsystemEventAction.UPDATED,
          null,
          fieldChanges(subsystem, { defaultRoleMapping: mapping }),
        ),
      },
      select: {
        id: true,
        name: true,
        defaultRoleMapping: true,
      },
    });
  }

  /* ---------------------------------------------------------------- */
  /* Change requests (handoff 2.2) and history (2.5)                   */
  /* ---------------------------------------------------------------- */

  /**
   * The values a change request asks for, normalised and checked with the
   * same rules as registration — the transport rule of
   * `registrableUrlProblem` (so ALLOW_LOCALHOST_CALLBACKS counts) and
   * `isRoleMapping`. Runs when the request is made and again when it is
   * approved, since the flag may have changed in between. 400 otherwise.
   */
  private requestedValues(input: Record<string, unknown>): RequestedValues {
    const values: RequestedValues = {};
    const problems: string[] = [];

    const unknown = Object.keys(input).filter(
      (field) =>
        input[field] !== undefined &&
        !(CHANGE_REQUEST_FIELDS as readonly string[]).includes(field),
    );
    if (unknown.length > 0) {
      problems.push(
        `a change request may only change ${CHANGE_REQUEST_FIELDS.join(', ')}`,
      );
    }

    const { callbackUrl, baseUrl, defaultRoleMapping } = input;

    if (callbackUrl !== undefined) {
      const problem =
        typeof callbackUrl === 'string'
          ? this.registrableUrlProblem('callbackUrl', callbackUrl)
          : 'callbackUrl must be a URL';
      if (problem) problems.push(problem);
      else values.callbackUrl = (callbackUrl as string).trim();
    }

    if (baseUrl !== undefined) {
      if (
        baseUrl === null ||
        (typeof baseUrl === 'string' && !baseUrl.trim())
      ) {
        values.baseUrl = null;
      } else {
        const problem =
          typeof baseUrl === 'string'
            ? this.registrableUrlProblem('baseUrl', baseUrl)
            : 'baseUrl must be a URL';
        if (problem) problems.push(problem);
        else values.baseUrl = (baseUrl as string).trim();
      }
    }

    if (defaultRoleMapping !== undefined) {
      if (isRoleMapping(defaultRoleMapping)) {
        values.defaultRoleMapping = defaultRoleMapping as Record<
          string,
          string
        >;
      } else {
        problems.push(
          'defaultRoleMapping must have at least one key, every key a core role in lower case and every value a non-empty string',
        );
      }
    }

    if (problems.length > 0) {
      throw new BadRequestException(problems);
    }

    return values;
  }

  /** The change request, scoped to its subsystem — 404 when either is missing. */
  private async findChangeRequestOrThrow(id: string, requestId: string) {
    const request = await this.prisma.subsystemChangeRequest.findFirst({
      where: { id: requestId, subsystemId: id },
    });

    if (!request) {
      throw new NotFoundException('Change request not found');
    }

    return request;
  }

  /**
   * Moves a PENDING request to `status` — conditional on it still being
   * PENDING, so two reviewers (or a review and a cancel) cannot both win.
   */
  private async closeChangeRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    data: Prisma.SubsystemChangeRequestUncheckedUpdateManyInput,
  ): Promise<void> {
    const claimed = await tx.subsystemChangeRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data,
    });

    if (claimed.count !== 1) {
      throw new ConflictException('This change request is no longer pending');
    }
  }

  /**
   * The owner asks to change the reviewed fields of an approved subsystem.
   * Nothing changes until an administrator approves; one pending request per
   * subsystem (409 for a second). Only the fields that differ are kept.
   */
  async createChangeRequest(
    id: string,
    dto: CreateChangeRequestDto,
    actor: SubsystemActor,
  ) {
    const subsystem = await this.findOrThrow(id);

    this.assertCanEdit(subsystem, actor);

    if (subsystem.approvalStatus !== 'APPROVED') {
      throw new ConflictException(
        `Only an approved subsystem takes change requests — while it is ${subsystem.approvalStatus} edit it directly`,
      );
    }

    const values = this.requestedValues({ ...dto });
    const changes = fieldChanges(subsystem, values);

    if (Object.keys(changes).length === 0) {
      throw new BadRequestException([
        `a change request must change at least one of ${CHANGE_REQUEST_FIELDS.join(', ')}`,
      ]);
    }

    const requested = Object.fromEntries(
      Object.keys(changes).map((field) => [
        field,
        values[field as keyof RequestedValues],
      ]),
    );

    try {
      // Serializable: two owners submitting at once both see "no pending
      // request", but PostgreSQL then fails one of them (P2034 → 409).
      return await this.prisma.$transaction(
        async (tx) => {
          const pending = await tx.subsystemChangeRequest.count({
            where: { subsystemId: id, status: 'PENDING' },
          });

          if (pending > 0) {
            throw new ConflictException(PENDING_REQUEST_TAKEN);
          }

          const request = await tx.subsystemChangeRequest.create({
            data: {
              subsystemId: id,
              requestedById: actor.id,
              changes: requested,
            },
            include: CHANGE_REQUEST_INCLUDE,
          });

          await tx.subsystemEvent.create({
            data: {
              subsystemId: id,
              actorId: actor.id,
              action: SubsystemEventAction.CHANGE_REQUESTED,
              changes: changes,
            },
          });

          return request;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isSerializationFailure(error)) {
        throw new ConflictException(PENDING_REQUEST_TAKEN);
      }
      throw error;
    }
  }

  /** Every change request of one subsystem, newest first (owner · admin). */
  async listChangeRequests(
    id: string,
    query: ListChangeRequestsQuery,
    actor: SubsystemActor,
  ) {
    const subsystem = await this.findOrThrow(id);

    this.assertCanRead(subsystem, actor);

    const where: Prisma.SubsystemChangeRequestWhereInput = {
      subsystemId: id,
      status: query.status,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subsystemChangeRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: CHANGE_REQUEST_INCLUDE,
      }),
      this.prisma.subsystemChangeRequest.count({ where }),
    ]);

    return Paginated.of(items, total, query.page, query.limit);
  }

  /** Change requests across the registry, for the reviewers' "คำขอ" page. */
  async listAllChangeRequests(query: ListChangeRequestsQuery) {
    const where: Prisma.SubsystemChangeRequestWhereInput = {
      status: query.status,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subsystemChangeRequest.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          ...CHANGE_REQUEST_INCLUDE,
          subsystem: {
            select: {
              id: true,
              name: true,
              displayName: true,
              callbackUrl: true,
              baseUrl: true,
              defaultRoleMapping: true,
            },
          },
        },
      }),
      this.prisma.subsystemChangeRequest.count({ where }),
    ]);

    return Paginated.of(items, total, query.page, query.limit);
  }

  /**
   * An administrator approves: the requested values are checked again (the
   * localhost flag may have been switched off since), then applied all at
   * once with the history event, in one transaction.
   */
  async approveChangeRequest(
    id: string,
    requestId: string,
    actor: SubsystemActor,
  ) {
    const request = await this.findChangeRequestOrThrow(id, requestId);

    if (request.status !== 'PENDING') {
      throw new ConflictException('This change request is no longer pending');
    }

    const values = this.requestedValues(
      (request.changes ?? {}) as Record<string, unknown>,
    );

    return this.prisma.$transaction(async (tx) => {
      const subsystem = await tx.subsystem.findUnique({ where: { id } });
      if (!subsystem) {
        throw new NotFoundException('Subsystem not found');
      }

      await this.closeChangeRequest(tx, requestId, {
        status: 'APPROVED',
        reviewedById: actor.id,
        reviewedAt: new Date(),
      });

      await tx.subsystem.update({
        where: { id },
        data: {
          ...values,
          ...this.event(
            actor,
            SubsystemEventAction.CHANGE_APPROVED,
            null,
            fieldChanges(subsystem, values),
          ),
        },
      });

      return tx.subsystemChangeRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: CHANGE_REQUEST_INCLUDE,
      });
    });
  }

  /** An administrator turns the request down; the registry stays as it is. */
  async rejectChangeRequest(
    id: string,
    requestId: string,
    reason: string,
    actor: SubsystemActor,
  ) {
    const subsystem = await this.findOrThrow(id);
    const request = await this.findChangeRequestOrThrow(id, requestId);

    return this.prisma.$transaction(async (tx) => {
      await this.closeChangeRequest(tx, requestId, {
        status: 'REJECTED',
        reason,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      });

      await tx.subsystemEvent.create({
        data: this.closedEvent(
          subsystem,
          request.changes,
          actor,
          SubsystemEventAction.CHANGE_REJECTED,
          reason,
        ),
      });

      return tx.subsystemChangeRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: CHANGE_REQUEST_INCLUDE,
      });
    });
  }

  /** The owner (or whoever asked) withdraws a pending request. */
  async cancelChangeRequest(
    id: string,
    requestId: string,
    actor: SubsystemActor,
  ) {
    const subsystem = await this.findOrThrow(id);

    this.assertCanEdit(subsystem, actor);

    const request = await this.findChangeRequestOrThrow(id, requestId);

    if (request.requestedById !== actor.id && !this.isOwner(subsystem, actor)) {
      throw new ForbiddenException(
        'Only the owner who asked can cancel this change request',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.closeChangeRequest(tx, requestId, { status: 'CANCELLED' });

      await tx.subsystemEvent.create({
        data: this.closedEvent(
          subsystem,
          request.changes,
          actor,
          SubsystemEventAction.CHANGE_CANCELLED,
        ),
      });

      return tx.subsystemChangeRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: CHANGE_REQUEST_INCLUDE,
      });
    });
  }

  /** History row for a request that closed without changing anything. */
  private closedEvent(
    subsystem: Subsystem,
    requested: Prisma.JsonValue,
    actor: SubsystemActor,
    action: SubsystemEventAction,
    reason?: string,
  ): Prisma.SubsystemEventUncheckedCreateInput {
    const changes = fieldChanges(
      subsystem,
      (requested ?? {}) as Record<string, unknown>,
    );

    return {
      subsystemId: subsystem.id,
      actorId: actor.id,
      action,
      reason,
      ...(Object.keys(changes).length > 0 && {
        changes: changes,
      }),
    };
  }

  /**
   * The timeline: who changed what, when, from what to what — newest first
   * (owner · admin). `changes` holds registry values only, never secrets.
   */
  async history(
    id: string,
    query: { page: number; limit: number },
    actor: SubsystemActor,
  ) {
    const subsystem = await this.findOrThrow(id);

    this.assertCanRead(subsystem, actor);

    const where = { subsystemId: id };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subsystemEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          action: true,
          reason: true,
          changes: true,
          createdAt: true,
          actor: PERSON,
        },
      }),
      this.prisma.subsystemEvent.count({ where }),
    ]);

    return Paginated.of(items, total, query.page, query.limit);
  }

  /* ---------------------------------------------------------------- */
  /* Exceptions                                                        */
  /* ---------------------------------------------------------------- */

  async createException(
    id: string,
    dto: CreateExceptionDto,
    actor: SubsystemActor,
  ) {
    const subsystem = await this.findOrThrow(id);

    this.assertCanEdit(subsystem, actor);

    await this.assertValidExceptions(subsystem.defaultRoleMapping, [dto]);

    const [exception] = await this.prisma.$transaction([
      this.prisma.subsystemException.create({
        data: {
          subsystemId: id,
          username: dto.username,
          role: dto.role,
          reason: dto.reason,
          status: 'REQUESTED',
        },
      }),
      this.prisma.subsystemEvent.create({
        data: {
          subsystemId: id,
          actorId: actor.id,
          action: SubsystemEventAction.EXCEPTION_REQUESTED,
          reason: `${dto.username} → ${dto.role}`,
        },
      }),
    ]);

    return exception;
  }

  async getExceptions(id: string, actor: SubsystemActor) {
    const subsystem = await this.findOrThrow(id);

    this.assertCanRead(subsystem, actor);

    return this.prisma.subsystemException.findMany({
      where: {
        subsystemId: id,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  /** Review queue across every subsystem. */
  async listExceptions(query: ListExceptionsQuery) {
    const where: Prisma.SubsystemExceptionWhereInput = {
      status: query.status,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subsystemException.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          subsystem: { select: { id: true, name: true, displayName: true } },
        },
      }),
      this.prisma.subsystemException.count({ where }),
    ]);

    return Paginated.of(items, total, query.page, query.limit);
  }

  private async decideException(
    id: string,
    exceptionId: string,
    decision: 'APPROVED' | 'REJECTED',
    actor: SubsystemActor,
  ) {
    await this.findOrThrow(id);

    const exception = await this.prisma.subsystemException.findUnique({
      where: { id: exceptionId },
    });

    if (!exception || exception.subsystemId !== id) {
      throw new NotFoundException('Exception not found');
    }

    if (exception.status !== 'REQUESTED') {
      const verb = decision === 'APPROVED' ? 'approved' : 'rejected';
      throw new ConflictException(
        `Exception cannot be ${verb} from status ${exception.status}`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.subsystemException.update({
        where: { id: exceptionId },
        data: {
          status: decision,
        },
      }),
      this.prisma.subsystemEvent.create({
        data: {
          subsystemId: id,
          actorId: actor.id,
          action:
            decision === 'APPROVED'
              ? SubsystemEventAction.EXCEPTION_APPROVED
              : SubsystemEventAction.EXCEPTION_REJECTED,
          reason: `${exception.username} → ${exception.role}`,
        },
      }),
    ]);

    return updated;
  }

  approveException(id: string, exceptionId: string, actor: SubsystemActor) {
    return this.decideException(id, exceptionId, 'APPROVED', actor);
  }

  rejectException(id: string, exceptionId: string, actor: SubsystemActor) {
    return this.decideException(id, exceptionId, 'REJECTED', actor);
  }
}
