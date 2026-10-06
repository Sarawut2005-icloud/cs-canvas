import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from 'src/database/prisma.service';
import { ImageStorageService } from './image-storage.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows removed per transaction, so one run never holds a huge one. */
export const PURGE_BATCH_SIZE = 200;

/**
 * Removes images that were soft-deleted more than `uploads.purgeAfterDays`
 * ago: their rows and their files on disk. Until then a deleted image
 * already answers 404, and its row can still be recovered by hand.
 */
@Injectable()
export class ImagePurgeService {
  private readonly logger = new Logger(ImagePurgeService.name);
  private readonly purgeAfterDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorageService,
    config: ConfigService,
  ) {
    this.purgeAfterDays = config.get<number>('uploads.purgeAfterDays') ?? 30;
  }

  @Cron('0 3 * * *', { name: 'image-purge', timeZone: 'Asia/Bangkok' })
  async run(): Promise<void> {
    try {
      const purged = await this.purge();
      if (purged === null) {
        this.logger.log('Another instance is purging images; skipped');
      } else if (purged > 0) {
        this.logger.log(`Purged ${purged} deleted image(s)`);
      }
    } catch (error) {
      this.logger.error('Image purge failed', error);
    }
  }

  /**
   * Returns how many images were removed, or null when another instance
   * holds the lock.
   */
  async purge(now = new Date()): Promise<number | null> {
    const cutoff = new Date(now.getTime() - this.purgeAfterDays * DAY_MS);
    let purged = 0;

    for (;;) {
      const count = await this.prisma.$transaction(
        async (tx) => {
          // Every replica runs the cron (tech-stack.md §1.4.1). The lock
          // belongs to the transaction, so a crashed run cannot leave it
          // held. 4801 is this job's number — no other job may use it.
          const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(4801) AS locked`;
          if (!locked) {
            return null;
          }

          // One statement picks and deletes the batch, so running it twice
          // cannot remove anything twice.
          const deleted = await tx.$queryRaw<
            { storagePath: string; thumbnailPath: string | null }[]
          >`
            DELETE FROM images
            WHERE id IN (
              SELECT id FROM images
              WHERE deleted_at < ${cutoff}
              ORDER BY deleted_at
              LIMIT ${PURGE_BATCH_SIZE}
            )
            RETURNING storage_path AS "storagePath",
                      thumbnail_path AS "thumbnailPath"`;

          // Before commit: if a file cannot be removed, the rows come back
          // and the next run tries again. A file that is already gone is not
          // an error.
          await Promise.all(
            deleted
              .flatMap((image) => [image.storagePath, image.thumbnailPath])
              .filter((storagePath) => storagePath !== null)
              .map((storagePath) => this.storage.remove(storagePath)),
          );

          return deleted.length;
        },
        { timeout: 60_000 },
      );

      if (count === null) {
        return purged === 0 ? null : purged;
      }
      purged += count;
      if (count < PURGE_BATCH_SIZE) {
        return purged;
      }
    }
  }
}
