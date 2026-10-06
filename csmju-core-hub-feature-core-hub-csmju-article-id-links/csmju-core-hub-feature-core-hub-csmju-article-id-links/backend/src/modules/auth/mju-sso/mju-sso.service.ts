import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';

import { AuthMethod } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { UserRole } from '../../users/user-role.enum';
import { AuthService } from '../auth.service';

/** Fields of the token.aspx answer this service reads. Everything else is ignored. */
interface MjuProfile {
  citizenID: string;
  e_mail?: string;
  /** Student code (รหัสนักศึกษา) — empty for staff. */
  studentCode?: string;
  titleName?: string;
  firstName?: string;
  lastName?: string;
}

/** Domain of the synthetic login e-mail used when MJU sends no e_mail. */
const SYNTHETIC_DOMAIN = 'sso.mju.local';

const CONNECT_TIMEOUT_MS = 15_000;

/** One answer for "not in the registry" and "no longer active": the reason stays internal. */
const NOT_REGISTERED = 'This MJU account is not registered in CSMJU2030';

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: { select: { name: true } },
} as const;

const PERSON_SELECT = {
  id: true,
  personType: true,
  staffType: true,
  status: true,
  coreUserId: true,
  universityEmail: true,
} as const;

type RegistryPerson = {
  id: string;
  personType: string;
  staffType: string | null;
  status: string;
  coreUserId: string | null;
  universityEmail: string | null;
};

type UserWithSubject = {
  id: string;
  email: string;
  username: string | null;
  role: { name: string };
  mjuSubject: string | null;
};

/** The registry decides the role of a new account; admin is never automatic. */
function roleFor(person: RegistryPerson): UserRole {
  // staff means employees who are not lecturers (standards 1.6.0)
  if (person.personType === 'STAFF')
    return person.staffType === 'LECTURER' ? UserRole.LECTURER : UserRole.STAFF;
  return person.status === 'GRADUATED' ? UserRole.ALUMNI : UserRole.STUDENT;
}

/**
 * MJU SSO (sso.mju.ac.th) sign-in for the Core Hub.
 *
 * Flow (see docs/MJU-SSO.md):
 *   browser → signin.aspx?cid=… → back to the frontend with ?ac=<code>
 *   frontend → POST /auth/mju/callback { code }
 *   this service → POST token.aspx { clientID, code } → profile
 *   → find or create the Core Hub user → AuthService.issueSession()
 *
 * The Core Hub stays the only token issuer: an SSO user receives exactly the
 * same RS256 access/refresh pair and session record as a password user, so
 * every subsystem keeps working unchanged.
 *
 * Privacy: the profile's citizenID (Thai national ID) is never stored or
 * logged. The account is linked through HMAC-SHA256(citizenID, secret),
 * which cannot be reversed or brute-forced without the server secret.
 */
@Injectable()
export class MjuSsoService {
  private readonly logger = new Logger(MjuSsoService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /** Replaced by tests; production uses the global fetch. */
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = (
    url,
    init,
  ) => fetch(url, init);

  get enabled(): boolean {
    return !!this.config.get<string>('mju.clientId');
  }

  async signIn(code: string) {
    if (!this.enabled) {
      throw new ServiceUnavailableException('MJU SSO is not configured');
    }

    const profile = await this.exchange(code);
    const user = await this.findOrCreateUser(profile);

    this.logger.log(
      JSON.stringify({ event: 'mju_sso.login_success', role: user.role.name }),
    );

    const tokens = await this.authService.issueSession(
      user,
      AuthMethod.MJU_SSO,
    );
    // false → the frontend sends the user to set a password before anything else.
    return {
      ...tokens,
      password_set: await this.authService.hasPassword(user.id),
    };
  }

  /** Server-to-server exchange of the authorization code for the profile. */
  private async exchange(code: string): Promise<MjuProfile> {
    const clientID = this.config.get<string>('mju.clientId');
    const tokenUrl = this.config.get<string>('mju.tokenUrl') ?? '';

    let response: Response;
    try {
      response = await this.fetchImpl(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ clientID, code }),
        redirect: 'manual',
        signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'mju_sso.api_failure',
          reason: error instanceof Error ? error.name : 'unknown',
        }),
      );
      throw new ServiceUnavailableException('MJU SSO is unreachable');
    }

    if (!response.ok) {
      this.logger.error(
        JSON.stringify({
          event: 'mju_sso.api_failure',
          status: response.status,
        }),
      );
      throw new ServiceUnavailableException('MJU SSO answered with an error');
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      this.logger.error(JSON.stringify({ event: 'mju_sso.invalid_json' }));
      throw new ServiceUnavailableException(
        'MJU SSO answered with invalid JSON',
      );
    }

    // token.aspx answers 200 with {status:"fail", message:"invalid grant"} for
    // a bad or expired code, and the profile object on success.
    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as MjuProfile).citizenID !== 'string' ||
      !(body as MjuProfile).citizenID
    ) {
      this.logger.warn(
        JSON.stringify({ event: 'mju_sso.login_failed_or_expired_code' }),
      );
      throw new UnauthorizedException('MJU SSO sign-in failed or expired');
    }

    // Field names only (never values) — lets operators confirm the mapping.
    this.logger.log(
      JSON.stringify({
        event: 'mju_sso.profile_received',
        fields: Object.keys(body).sort(),
      }),
    );

    return body as MjuProfile;
  }

  private subjectOf(citizenId: string): string {
    const secret = this.config.get<string>('mju.subjectSecret');
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException(
        'MJU_SUBJECT_SECRET must be set (32+ characters) to enable MJU SSO',
      );
    }
    return createHmac('sha256', secret).update(citizenId.trim()).digest('hex');
  }

  /**
   * Resolves the Core Hub account for an SSO profile. Only people the
   * CSMJU2030 registry knows get in (PM decision, 28 Sep 2026):
   *   1. by mju_subject — linked on an earlier sign-in;
   *   2. by the e-mail MJU sends — an existing Core Hub account (staff and
   *      admins; MJU sends no e-mail for students);
   *   3. by the people registry — the student code for students, the
   *      university e-mail for staff. The person's own account is used when
   *      there is one (the CSV import creates and links it), so a student
   *      never ends up with a second account; otherwise one is created.
   * An MJU user outside the registry, or a person whose status is INACTIVE,
   * is refused with 403 and nothing is created. Admin rights are never
   * granted automatically.
   */
  private async findOrCreateUser(profile: MjuProfile) {
    const mjuSubject = this.subjectOf(profile.citizenID);
    const email = profile.e_mail?.trim().toLowerCase() || null;
    const studentCode = profile.studentCode?.trim() || null;

    const linked = await this.prisma.user.findUnique({
      where: { mjuSubject },
      select: USER_SELECT,
    });
    if (linked) {
      await this.assertPersonActive(linked.id);
      return this.refreshHandle(linked, studentCode);
    }

    if (email) {
      const byEmail = await this.findUser({ email });
      if (byEmail) return this.link(byEmail, mjuSubject);
    }

    const person =
      (studentCode
        ? await this.prisma.person.findUnique({
            where: { personCode: studentCode },
            select: PERSON_SELECT,
          })
        : null) ??
      (email
        ? await this.prisma.person.findUnique({
            where: { universityEmail: email },
            select: PERSON_SELECT,
          })
        : null);

    if (!person) {
      this.logger.warn(JSON.stringify({ event: 'mju_sso.not_registered' }));
      throw new ForbiddenException(NOT_REGISTERED);
    }
    if (person.status === 'INACTIVE') {
      this.logger.warn(JSON.stringify({ event: 'mju_sso.person_inactive' }));
      throw new ForbiddenException(NOT_REGISTERED);
    }

    // The person's own account — the CSV import creates one per student.
    if (person.coreUserId) {
      const own = await this.findUser({ id: person.coreUserId });
      if (own) return this.link(own, mjuSubject);
    }

    // An account with the registry's e-mail that was never linked to the
    // person: take it over rather than collide on users.email.
    const registryEmail = person.universityEmail?.trim().toLowerCase() || null;
    if (registryEmail && registryEmail !== email) {
      const byRegistryEmail = await this.findUser({ email: registryEmail });
      if (byRegistryEmail) {
        const user = await this.link(byRegistryEmail, mjuSubject);
        await this.linkPerson(person, user.id);
        return user;
      }
    }

    const roleName = roleFor(person);
    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
      select: { id: true },
    });
    if (!role) throw new ServiceUnavailableException('Roles are not seeded');

    const id = randomUUID();
    // The login e-mail: MJU's, else the registry's, else a synthetic one
    // (the student code makes it recognisable, the subject hash is the fallback).
    const loginEmail =
      email ??
      registryEmail ??
      `${studentCode ?? `mju-${mjuSubject.slice(0, 16)}`}@${SYNTHETIC_DOMAIN}`;
    // The handle the UI shows: student code first, then the e-mail's local part.
    const username = await this.freeUsername(
      studentCode ?? loginEmail.split('@')[0],
    );

    const created = await this.prisma.user.create({
      data: {
        id,
        email: loginEmail,
        username,
        passwordHash: null,
        mjuSubject,
        roleId: role.id,
      },
      select: USER_SELECT,
    });
    await this.linkPerson(person, id);

    this.logger.log(
      JSON.stringify({ event: 'mju_sso.user_created', role: roleName }),
    );

    return created;
  }

  private findUser(
    where: { id: string } | { email: string },
  ): Promise<UserWithSubject | null> {
    return this.prisma.user.findUnique({
      where,
      select: { ...USER_SELECT, mjuSubject: true },
    });
  }

  /** Links an existing account to this MJU identity (once) and returns it. */
  private async link(user: UserWithSubject, mjuSubject: string) {
    if (user.mjuSubject && user.mjuSubject !== mjuSubject) {
      this.logger.warn(
        JSON.stringify({ event: 'mju_sso.account_linked_elsewhere' }),
      );
      throw new ConflictException(
        'This account is already linked to another MJU identity',
      );
    }
    await this.assertPersonActive(user.id);

    const { mjuSubject: current, ...rest } = user;
    if (current === mjuSubject) return rest;
    return this.prisma.user.update({
      where: { id: user.id },
      data: { mjuSubject },
      select: USER_SELECT,
    });
  }

  /** Sets people.core_user_id when the person has no account yet. */
  private async linkPerson(person: RegistryPerson, userId: string) {
    if (person.coreUserId) return;
    await this.prisma.person.update({
      where: { id: person.id },
      data: { coreUserId: userId },
    });
  }

  /**
   * An account linked to a person who has left (INACTIVE) cannot sign in
   * through MJU SSO, even though MJU itself still knows them. Accounts with
   * no person (seeded or created by an admin) are not affected.
   */
  private async assertPersonActive(userId: string) {
    const person = await this.prisma.person.findUnique({
      where: { coreUserId: userId },
      select: { status: true },
    });
    if (person?.status === 'INACTIVE') {
      this.logger.warn(JSON.stringify({ event: 'mju_sso.person_inactive' }));
      throw new ForbiddenException(NOT_REGISTERED);
    }
  }

  /**
   * Accounts created before MJU sent a student code (or with a placeholder
   * handle) pick up the student code on their next sign-in, so the UI stops
   * showing `mju-<hash>`. Only placeholder values are replaced.
   */
  private async refreshHandle<
    T extends { id: string; email: string; username: string | null },
  >(user: T, studentCode: string | null): Promise<T> {
    if (!studentCode) return user;

    const placeholderHandle =
      !user.username || user.username.startsWith('mju-');
    const placeholderEmail =
      user.email.startsWith('mju-') &&
      user.email.endsWith(`@${SYNTHETIC_DOMAIN}`);
    if (!placeholderHandle && !placeholderEmail) return user;

    const data: { username?: string; email?: string } = {};
    if (placeholderHandle && user.username !== studentCode) {
      const free = await this.freeUsername(studentCode);
      if (free) data.username = free;
    }
    if (placeholderEmail) {
      const candidate = `${studentCode}@${SYNTHETIC_DOMAIN}`;
      const taken = await this.prisma.user.findUnique({
        where: { email: candidate },
        select: { id: true },
      });
      if (!taken) data.email = candidate;
    }
    if (Object.keys(data).length === 0) return user;

    await this.prisma.user.update({ where: { id: user.id }, data });
    return { ...user, ...data };
  }

  /** `username` is unique; fall back to null rather than fail the sign-in. */
  private async freeUsername(candidate: string): Promise<string | null> {
    const taken = await this.prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    return taken ? null : candidate;
  }
}
