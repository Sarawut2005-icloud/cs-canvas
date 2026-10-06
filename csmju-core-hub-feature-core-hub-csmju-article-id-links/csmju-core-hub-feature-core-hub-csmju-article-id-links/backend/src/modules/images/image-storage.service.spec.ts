import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';

import { ImageCategory } from '../../../generated/prisma/client';
import { ImageStorageService } from './image-storage.service';

describe('ImageStorageService', () => {
  let root: string;
  let storage: ImageStorageService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'core-hub-uploads-'));
    storage = new ImageStorageService(
      new ConfigService({ uploads: { dir: root } }),
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('files an image under its category folder and month, named by id', async () => {
    const id = randomUUID();
    const storagePath = await storage.save(
      ImageCategory.PROFILE,
      id,
      Buffer.from('image bytes'),
      { now: new Date('2026-09-27T10:00:00Z') },
    );

    expect(storagePath).toBe(`profiles/2026-09/${id}.webp`);
    expect(await readFile(path.join(root, storagePath), 'utf8')).toBe(
      'image bytes',
    );
    // The temporary file used for the atomic write is gone.
    expect(await readdir(path.join(root, 'profiles/2026-09'))).toEqual([
      `${id}.webp`,
    ]);
  });

  it('names a thumbnail after its image', async () => {
    const id = randomUUID();
    const storagePath = await storage.save(
      ImageCategory.NEWS,
      id,
      Buffer.from('x'),
      { variant: 'thumb', now: new Date('2026-01-05T00:00:00Z') },
    );

    expect(storagePath).toBe(`news/2026-01/${id}.thumb.webp`);
  });

  it.each(['../../etc/passwd', 'avatar.png', randomUUID().toUpperCase()])(
    'refuses an id that is not a lowercase UUID: %s',
    async (id) => {
      await expect(
        storage.save(ImageCategory.NEWS, id, Buffer.from('x')),
      ).rejects.toThrow('image id must be a lowercase UUID');
    },
  );

  it.each(['../outside.webp', '/etc/passwd', '.', ''])(
    'refuses a storage path outside the upload directory: %p',
    (storagePath) => {
      expect(() => storage.resolve(storagePath)).toThrow(
        'storage path is outside the upload directory',
      );
    },
  );

  it('removes a stored file, and tolerates one already gone', async () => {
    const storagePath = await storage.save(
      ImageCategory.GENERAL,
      randomUUID(),
      Buffer.from('x'),
    );

    await storage.remove(storagePath);
    await expect(stat(path.join(root, storagePath))).rejects.toThrow();
    await expect(storage.remove(storagePath)).resolves.toBeUndefined();
  });
});
