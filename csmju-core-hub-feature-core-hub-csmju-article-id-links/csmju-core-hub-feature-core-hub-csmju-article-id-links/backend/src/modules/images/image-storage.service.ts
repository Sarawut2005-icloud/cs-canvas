import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ImageCategory } from '../../../generated/prisma/client';
import { IMAGE_RULES, OUTPUT_FORMAT } from './image-rules';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Keeps image files on local disk under UPLOAD_DIR:
 *
 *   <UPLOAD_DIR>/<category folder>/<YYYY-MM>/<image id>.webp
 *   <UPLOAD_DIR>/<category folder>/<YYYY-MM>/<image id>.thumb.webp
 *
 * Paths handed back are relative to UPLOAD_DIR, so the folder can move
 * without rewriting the database.
 */
@Injectable()
export class ImageStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.get<string>('uploads.dir') ?? 'uploads');
  }

  /** Writes the file and returns its storage path. */
  async save(
    category: ImageCategory,
    id: string,
    data: Buffer,
    { variant, now = new Date() }: { variant?: 'thumb'; now?: Date } = {},
  ): Promise<string> {
    // The id becomes the file name — only a UUID can never contain `/` or `..`.
    if (!UUID.test(id)) {
      throw new Error(`image id must be a lowercase UUID, got "${id}"`);
    }

    const month = now.toISOString().slice(0, 7);
    const storagePath = path.posix.join(
      IMAGE_RULES[category].folder,
      month,
      [id, variant, OUTPUT_FORMAT.extension].filter(Boolean).join('.'),
    );
    const target = this.resolve(storagePath);

    await mkdir(path.dirname(target), { recursive: true });

    // Write beside the target and rename, so a reader never sees half a file.
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, data, { flag: 'wx' });
    try {
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }

    return storagePath;
  }

  /** Absolute path of a stored file; refuses anything outside UPLOAD_DIR. */
  resolve(storagePath: string): string {
    const absolute = path.resolve(this.root, storagePath);
    if (!absolute.startsWith(this.root + path.sep)) {
      throw new Error('storage path is outside the upload directory');
    }
    return absolute;
  }

  /** Deletes a stored file. A file that is already gone is not an error. */
  async remove(storagePath: string): Promise<void> {
    await rm(this.resolve(storagePath), { force: true });
  }
}
