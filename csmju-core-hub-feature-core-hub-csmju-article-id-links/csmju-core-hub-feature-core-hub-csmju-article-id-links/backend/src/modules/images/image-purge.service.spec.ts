import { randomUUID } from 'node:crypto';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from 'src/database/prisma.service';
import { ImageCategory } from '../../../generated/prisma/client';
import { ImagePurgeService, PURGE_BATCH_SIZE } from './image-purge.service';
import { ImageStorageService } from './image-storage.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-31T20:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

interface Row {
  id: string;
  storagePath: string;
  thumbnailPath: string | null;
  deletedAt: Date | null;
}

/**
 * The slice of PrismaService the purge uses, kept in memory. It answers the
 * two raw statements and undoes a transaction that throws.
 */
class FakePrisma {
  images: Row[] = [];
  lockHeldElsewhere = false;
  failNextDelete = false;
  transactions = 0;
  statements: { sql: string; values: unknown[] }[] = [];

  private readonly tx = {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?').replace(/\s+/g, ' ').trim();
      this.statements.push({ sql, values });

      if (sql.includes('pg_try_advisory_xact_lock')) {
        return Promise.resolve([{ locked: !this.lockHeldElsewhere }]);
      }

      if (this.failNextDelete) {
        this.failNextDelete = false;
        return Promise.reject(new Error('database is down'));
      }
      const [cutoff, limit] = values as [Date, number];
      const batch = this.images
        .filter((row) => row.deletedAt && row.deletedAt < cutoff)
        .sort((a, b) => a.deletedAt!.getTime() - b.deletedAt!.getTime())
        .slice(0, limit);
      this.images = this.images.filter((row) => !batch.includes(row));
      return Promise.resolve(
        batch.map(({ storagePath, thumbnailPath }) => ({
          storagePath,
          thumbnailPath,
        })),
      );
    },
  };

  async $transaction(work: (tx: FakePrisma['tx']) => Promise<unknown>) {
    this.transactions += 1;
    const before = [...this.images];
    try {
      return await work(this.tx);
    } catch (error) {
      this.images = before;
      throw error;
    }
  }
}

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

describe('ImagePurgeService', () => {
  let root: string;
  let prisma: FakePrisma;
  let storage: ImageStorageService;
  let purger: ImagePurgeService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'core-hub-purge-'));
    const config = new ConfigService({
      uploads: { dir: root, purgeAfterDays: 30 },
    });
    prisma = new FakePrisma();
    storage = new ImageStorageService(config);
    purger = new ImagePurgeService(
      prisma as unknown as PrismaService,
      storage,
      config,
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  /** Stores a real file (and thumbnail) and a row pointing at them. */
  async function stored(deletedAt: Date | null, thumbnail = true) {
    const id = randomUUID();
    const bytes = Buffer.from('image bytes');
    const row: Row = {
      id,
      storagePath: await storage.save(ImageCategory.NEWS, id, bytes),
      thumbnailPath: thumbnail
        ? await storage.save(ImageCategory.NEWS, id, bytes, {
            variant: 'thumb',
          })
        : null,
      deletedAt,
    };
    prisma.images.push(row);
    return row;
  }

  const filesOf = (row: Row) =>
    [row.storagePath, row.thumbnailPath]
      .filter((storagePath) => storagePath !== null)
      .map((storagePath) => storage.resolve(storagePath));

  it('removes the files and rows of images deleted more than 30 days ago', async () => {
    const old = await stored(daysAgo(31));
    const oldNoThumb = await stored(daysAgo(90), false);
    const recent = await stored(daysAgo(29));
    const live = await stored(null);

    expect(await purger.purge(NOW)).toBe(2);

    expect(prisma.images.map((row) => row.id).sort()).toEqual(
      [recent.id, live.id].sort(),
    );
    for (const file of [...filesOf(old), ...filesOf(oldNoThumb)]) {
      expect(await exists(file)).toBe(false);
    }
    for (const file of [...filesOf(recent), ...filesOf(live)]) {
      expect(await exists(file)).toBe(true);
    }
  });

  it('does nothing while another instance holds the lock', async () => {
    const old = await stored(daysAgo(31));
    prisma.lockHeldElsewhere = true;

    expect(await purger.purge(NOW)).toBeNull();

    expect(prisma.images).toHaveLength(1);
    for (const file of filesOf(old)) {
      expect(await exists(file)).toBe(true);
    }
  });

  it('works through a large backlog in batches', async () => {
    // Rows only — removing a file that is not there is not an error.
    for (let i = 0; i < PURGE_BATCH_SIZE * 2 + 5; i += 1) {
      prisma.images.push({
        id: randomUUID(),
        storagePath: `news/2026-09/${randomUUID()}.webp`,
        thumbnailPath: null,
        deletedAt: daysAgo(40),
      });
    }

    expect(await purger.purge(NOW)).toBe(PURGE_BATCH_SIZE * 2 + 5);
    expect(prisma.images).toHaveLength(0);
    expect(prisma.transactions).toBe(3);
  });

  it('picks and deletes each batch in one statement', async () => {
    await stored(daysAgo(31));

    await purger.purge(NOW);

    const [lock, remove] = prisma.statements;
    expect(lock.sql).toContain('pg_try_advisory_xact_lock(4801)');
    expect(remove.sql).toMatch(/^DELETE FROM images WHERE .*deleted_at < \?/);
    expect(remove.sql).toContain('RETURNING');
    expect(remove.values).toEqual([daysAgo(30), PURGE_BATCH_SIZE]);
    expect(prisma.statements).toHaveLength(2);
  });

  it('removes no file when the delete fails, and finishes on the next run', async () => {
    const old = await stored(daysAgo(31));
    prisma.failNextDelete = true;

    await expect(purger.purge(NOW)).rejects.toThrow('database is down');
    expect(prisma.images).toHaveLength(1);
    for (const file of filesOf(old)) {
      expect(await exists(file)).toBe(true);
    }

    expect(await purger.purge(NOW)).toBe(1);
    expect(prisma.images).toHaveLength(0);
    for (const file of filesOf(old)) {
      expect(await exists(file)).toBe(false);
    }
  });

  it('puts the rows back when a file cannot be removed', async () => {
    const old = await stored(daysAgo(31));
    jest
      .spyOn(storage, 'remove')
      .mockRejectedValueOnce(new Error('permission denied'));

    await expect(purger.purge(NOW)).rejects.toThrow('permission denied');
    expect(prisma.images.map((row) => row.id)).toEqual([old.id]);

    expect(await purger.purge(NOW)).toBe(1);
    expect(prisma.images).toHaveLength(0);
  });

  it('logs a failed run instead of throwing out of the cron', async () => {
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    // run() purges against the real clock.
    await stored(new Date(Date.now() - 31 * DAY_MS));
    prisma.failNextDelete = true;

    await expect(purger.run()).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith(
      'Image purge failed',
      expect.any(Error),
    );
    logged.mockRestore();
  });
});
