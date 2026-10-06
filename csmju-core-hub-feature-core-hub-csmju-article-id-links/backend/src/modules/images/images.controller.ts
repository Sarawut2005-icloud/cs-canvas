import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  BadRequestException,
  Body,
  CallHandler,
  Controller,
  Delete,
  Get,
  Injectable,
  NestInterceptor,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { catchError, Observable, throwError } from 'rxjs';

import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubsystemTokenAllowed } from '../auth/decorators/subsystem-token-allowed.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import {
  AnyPermissions,
  Permissions,
} from '../authorization/permissions.decorator';
import { Permission } from '../authorization/permission.enum';
import { ImageFileQuery, ListImagesQuery } from './dto/list-images.query';
import { UploadImageDto } from './dto/upload-image.dto';
import { MAX_UPLOAD_BYTES } from './image-rules';
import { ImagesService } from './images.service';

/** Ids are server-made UUID v4; anything else cannot exist. */
const IMAGE_ID = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new NotFoundException('Image not found'),
});

/**
 * Multer answers an oversized file with 413, which is not one of the
 * standard error codes — report it as 400 VALIDATION_ERROR like every other
 * rejected file.
 */
@Injectable()
export class UploadLimitInterceptor implements NestInterceptor {
  intercept(_context: unknown, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(
        catchError((error: unknown) =>
          throwError(() =>
            error instanceof PayloadTooLargeException
              ? new BadRequestException([
                  `file must be at most ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`,
                ])
              : error,
          ),
        ),
      );
  }
}

const READ = [Permission.IMAGE_READ_OWN, Permission.IMAGE_READ_ANY];
const DELETE = [Permission.IMAGE_DELETE_OWN, Permission.IMAGE_DELETE_ANY];

/**
 * Every route declares a permission — PermissionsGuard lets an undecorated
 * route through. `:own` routes are narrowed to the caller's uploads in the
 * service. The public file route lives in `ImageFilesController`.
 */
@Controller('images')
@UseGuards(JwtAuthGuard, PermissionsGuard)
// The central image store for subsystems — every method (CORE_HUB_TOKEN_SCOPE 2.2).
@SubsystemTokenAllowed()
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly config: ConfigService,
  ) {}

  /** Where `<img src>` URLs point: PUBLIC_URL, else this request's origin. */
  private baseUrl(request: Request): string {
    return (
      this.config.get<string>('app.publicUrl') ||
      `${request.protocol}://${request.get('host')}`
    );
  }

  @Post()
  // Decoding and re-encoding is CPU-heavy, so uploads get their own per-IP
  // cap on top of the app-wide ones. The guard runs before multer reads the
  // body.
  @RateLimit('imageUpload')
  @Permissions(Permission.IMAGE_UPLOAD)
  @UseInterceptors(
    UploadLimitInterceptor,
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadImageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (!file) {
      throw new BadRequestException(['file is required']);
    }
    const image = await this.imagesService.upload(file.buffer, dto, user);
    return this.imagesService.toView(image, this.baseUrl(request));
  }

  @Get()
  @AnyPermissions(...READ)
  async list(
    @Query() query: ListImagesQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const page = await this.imagesService.list(query, user);
    const baseUrl = this.baseUrl(request);
    return page.map((image) => this.imagesService.toView(image, baseUrl));
  }

  @Get(':id')
  @AnyPermissions(...READ)
  async getById(
    @Param('id', IMAGE_ID) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const image = await this.imagesService.findOne(id, user);
    return this.imagesService.toView(image, this.baseUrl(request));
  }

  @Delete(':id')
  @AnyPermissions(...DELETE)
  async delete(
    @Param('id', IMAGE_ID) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.imagesService.remove(id, user);
  }
}

/**
 * `GET /api/v1/images/:id/file` — the image bytes for `<img src>`.
 *
 * Public on purpose (core-hub-rules.md §6): a browser cannot attach a token
 * to an `<img>`. Ids are unguessable UUIDs and there is no public listing.
 * Raw bytes, not the envelope — ResponseInterceptor passes StreamableFile
 * through.
 */
@Controller('images')
export class ImageFilesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get(':id/file')
  async file(
    @Param('id', IMAGE_ID) id: string,
    @Query() query: ImageFileQuery,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.imagesService.file(id, query.size);

    let size: number;
    try {
      size = (await stat(file.path)).size;
    } catch {
      throw new NotFoundException('Image not found');
    }

    response.set({
      // A stored file never changes (a new picture gets a new id), but a
      // deleted one must stop being served, so caches keep it for a day at
      // most.
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      // Subsystems on other origins embed these images.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    return new StreamableFile(createReadStream(file.path), {
      type: file.mimeType,
      length: size,
      disposition: `inline; filename="${id}.webp"`,
    });
  }
}
