import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';
import { Paginated } from 'src/common/pagination/paginated';
import {
  Image,
  ImageCategory,
  Prisma,
  SubsystemApprovalStatus,
  SubsystemStatus,
} from '../../../generated/prisma/client';
import { Permission } from '../authorization/permission.enum';
import { roleHasPermission } from '../authorization/role-permissions';
import { ListImagesQuery } from './dto/list-images.query';
import { UploadImageDto } from './dto/upload-image.dto';
import { processImage } from './image-processor';
import { ImageStorageService } from './image-storage.service';

/** Who is acting — the subset of the authenticated user the rules need. */
export interface ImageActor {
  id: string;
  role: string;
}

/** What the API returns for an image. `storagePath` never leaves the server. */
export interface ImageView {
  id: string;
  category: ImageCategory;
  url: string;
  thumbnailUrl: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  subsystemId: string | null;
  uploadedById: string;
  createdAt: Date;
}

/** A stored file ready to stream. */
export interface ImageFile {
  path: string;
  mimeType: string;
}

@Injectable()
export class ImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorageService,
  ) {}

  private can(actor: ImageActor, permission: Permission): boolean {
    return roleHasPermission(actor.role, permission);
  }

  /** `baseUrl` is the public origin of the API, without a trailing slash. */
  toView(image: Image, baseUrl: string): ImageView {
    const url = `${baseUrl}/api/v1/images/${image.id}/file`;
    return {
      id: image.id,
      category: image.category,
      url,
      thumbnailUrl: `${url}?size=thumb`,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
      subsystemId: image.subsystemId,
      uploadedById: image.uploadedById,
      createdAt: image.createdAt,
    };
  }

  /**
   * Validates, resizes and stores an upload. A profile picture becomes the
   * uploader's current one and their previous profile pictures are
   * soft-deleted.
   */
  async upload(
    file: Buffer,
    dto: UploadImageDto,
    actor: ImageActor,
  ): Promise<Image> {
    if (
      dto.category === ImageCategory.NEWS &&
      !this.can(actor, Permission.CONTENT_CREATE)
    ) {
      throw new ForbiddenException(
        `Uploading ${dto.category} images requires ${Permission.CONTENT_CREATE}`,
      );
    }

    let subsystemId: string | null = null;
    if (dto.subsystem) {
      const subsystem = await this.prisma.subsystem.findUnique({
        where: { name: dto.subsystem },
        select: { id: true, approvalStatus: true, status: true },
      });
      if (!subsystem) {
        throw new BadRequestException([
          `subsystem "${dto.subsystem}" is not registered`,
        ]);
      }
      // Any staff member can file a registration; until an admin approves
      // it, it must not become a label on stored images.
      if (subsystem.approvalStatus !== SubsystemApprovalStatus.APPROVED) {
        throw new BadRequestException([
          `subsystem "${dto.subsystem}" is not approved`,
        ]);
      }
      // Same rule as SSO: a subsystem that is switched off or suspended gets
      // no tokens, so it gets no new images either.
      if (subsystem.status !== SubsystemStatus.ACTIVE) {
        throw new BadRequestException([
          `subsystem "${dto.subsystem}" is not active`,
        ]);
      }
      subsystemId = subsystem.id;
    }

    const { image, thumbnail } = await processImage(file, dto.category);

    const id = randomUUID();
    const now = new Date();
    const written: string[] = [];

    try {
      const storagePath = await this.storage.save(
        dto.category,
        id,
        image.data,
        {
          now,
        },
      );
      written.push(storagePath);

      let thumbnailPath: string | null = null;
      if (thumbnail) {
        thumbnailPath = await this.storage.save(
          dto.category,
          id,
          thumbnail.data,
          { variant: 'thumb', now },
        );
        written.push(thumbnailPath);
      }

      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.image.create({
          data: {
            id,
            category: dto.category,
            subsystemId,
            uploadedById: actor.id,
            mimeType: image.mimeType,
            sizeBytes: image.sizeBytes,
            width: image.width,
            height: image.height,
            storagePath,
            thumbnailPath,
            createdAt: now,
          },
        });

        if (dto.category === ImageCategory.PROFILE) {
          await tx.user.update({
            where: { id: actor.id },
            data: { profileImageId: id },
          });
          await tx.image.updateMany({
            where: {
              uploadedById: actor.id,
              category: ImageCategory.PROFILE,
              deletedAt: null,
              id: { not: id },
            },
            data: { deletedAt: now },
          });
        }

        return created;
      });
    } catch (error) {
      // Nothing in the database points at these files — don't leave them.
      await Promise.all(written.map((path) => this.storage.remove(path)));
      throw error;
    }
  }

  /** Callers without `image:read:any` only see their own uploads. */
  async list(
    query: ListImagesQuery,
    actor: ImageActor,
  ): Promise<Paginated<Image>> {
    const where: Prisma.ImageWhereInput = {
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(this.can(actor, Permission.IMAGE_READ_ANY)
        ? {}
        : { uploadedById: actor.id }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.image.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.image.count({ where }),
    ]);

    return Paginated.of(items, total, query.page, query.limit);
  }

  private async findLive(id: string): Promise<Image> {
    const image = await this.prisma.image.findFirst({
      where: { id, deletedAt: null },
    });
    if (!image) {
      throw new NotFoundException('Image not found');
    }
    return image;
  }

  /** `:own` is checked against the stored uploader — 403, not 404. */
  async findOne(id: string, actor: ImageActor): Promise<Image> {
    const image = await this.findLive(id);
    if (
      !this.can(actor, Permission.IMAGE_READ_ANY) &&
      image.uploadedById !== actor.id
    ) {
      throw new ForbiddenException('You can only view images you uploaded');
    }
    return image;
  }

  /**
   * Soft-deletes the image, and clears it as anyone's profile picture. The
   * file stays on disk; `GET …/file` answers 404 from now on.
   */
  async remove(
    id: string,
    actor: ImageActor,
  ): Promise<{ id: string; deleted: true }> {
    const image = await this.findLive(id);
    if (
      !this.can(actor, Permission.IMAGE_DELETE_ANY) &&
      image.uploadedById !== actor.id
    ) {
      throw new ForbiddenException('You can only delete images you uploaded');
    }

    await this.prisma.$transaction([
      this.prisma.image.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.user.updateMany({
        where: { profileImageId: id },
        data: { profileImageId: null },
      }),
    ]);

    return { id, deleted: true };
  }

  /** The file behind a live image. Public — no actor. */
  async file(id: string, size?: 'thumb'): Promise<ImageFile> {
    const image = await this.findLive(id);
    const storagePath =
      size === 'thumb' && image.thumbnailPath
        ? image.thumbnailPath
        : image.storagePath;
    return {
      path: this.storage.resolve(storagePath),
      mimeType: image.mimeType,
    };
  }
}
