import { crc32, deflateSync } from 'node:zlib';
import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import { ImageCategory } from '../../../generated/prisma/client';
import { processImage, sniffFormat } from './image-processor';

function solid(width: number, height: number): sharp.Sharp {
  return sharp({
    create: { width, height, channels: 3, background: '#3366cc' },
  });
}

const jpeg = (width: number, height: number) =>
  solid(width, height).jpeg().toBuffer();

/**
 * A PNG that claims `width`×`height` but carries a single byte of pixel data
 * — a few hundred bytes on disk, gigabytes once decoded.
 */
function pngBomb(width: number, height: number): Buffer {
  const chunk = (type: string, body: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, 'latin1'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.alloc(1))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A baseline JPEG header (SOF0 + SOS) claiming `width`×`height` with no
 * scan data behind it.
 */
function jpegBomb(width: number, height: number): Buffer {
  // prettier-ignore
  const sof = Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
  ]);
  // prettier-ignore
  const sos = Buffer.from([
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  ]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    sof,
    sos,
    Buffer.from([0xff, 0xd9]),
  ]);
}

/** The main stored copy, without its thumbnail. */
async function storedImage(input: Buffer, category: ImageCategory) {
  return (await processImage(input, category)).image;
}

async function rejection(promise: Promise<unknown>): Promise<string[]> {
  const error: unknown = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(BadRequestException);
  const body = (error as BadRequestException).getResponse() as {
    message: string[];
  };
  return body.message;
}

describe('sniffFormat', () => {
  it('recognises JPEG, PNG and WebP by their magic bytes', async () => {
    expect(sniffFormat(await jpeg(4, 4))).toBe('jpeg');
    expect(sniffFormat(await solid(4, 4).png().toBuffer())).toBe('png');
    expect(sniffFormat(await solid(4, 4).webp().toBuffer())).toBe('webp');
  });

  it('refuses GIF, SVG and text renamed to an image', async () => {
    expect(sniffFormat(await solid(4, 4).gif().toBuffer())).toBeNull();
    expect(
      sniffFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(sniffFormat(Buffer.from('<html><script>'))).toBeNull();
    expect(sniffFormat(Buffer.alloc(0))).toBeNull();
  });
});

describe('processImage', () => {
  it('stores everything as WebP', async () => {
    const png = await solid(40, 30).png().toBuffer();
    const result = await storedImage(png, ImageCategory.GENERAL);

    expect(result.mimeType).toBe('image/webp');
    expect(sniffFormat(result.data)).toBe('webp');
    expect(result.sizeBytes).toBe(result.data.length);
  });

  describe('resizing', () => {
    it('crops profile pictures to a 512px square', async () => {
      const result = await storedImage(
        await jpeg(1200, 800),
        ImageCategory.PROFILE,
      );
      expect([result.width, result.height]).toEqual([512, 512]);
    });

    it('crops small profile pictures to a square without enlarging', async () => {
      const result = await storedImage(
        await jpeg(300, 200),
        ImageCategory.PROFILE,
      );
      expect([result.width, result.height]).toEqual([200, 200]);
    });

    it('caps news images at 1920px wide and keeps the aspect ratio', async () => {
      const result = await storedImage(
        await jpeg(3840, 2160),
        ImageCategory.NEWS,
      );
      expect([result.width, result.height]).toEqual([1920, 1080]);
    });

    it('leaves the height of tall news images alone', async () => {
      const result = await storedImage(
        await jpeg(1000, 3000),
        ImageCategory.NEWS,
      );
      expect([result.width, result.height]).toEqual([1000, 3000]);
    });

    it('caps the longer side of general images at 1920px', async () => {
      const result = await storedImage(
        await jpeg(1000, 3000),
        ImageCategory.GENERAL,
      );
      expect([result.width, result.height]).toEqual([640, 1920]);
    });

    it('accepts a 50 MP phone photo, over the PNG limit', async () => {
      const result = await storedImage(
        await jpeg(8165, 6124),
        ImageCategory.NEWS,
      );
      expect([result.width, result.height]).toEqual([1920, 1440]);
    });

    it('never enlarges a small image', async () => {
      const result = await storedImage(
        await jpeg(800, 600),
        ImageCategory.NEWS,
      );
      expect([result.width, result.height]).toEqual([800, 600]);
    });
  });

  describe('thumbnails', () => {
    it('makes a 400px-wide copy of news and general images', async () => {
      for (const category of [ImageCategory.NEWS, ImageCategory.GENERAL]) {
        const { image, thumbnail } = await processImage(
          await jpeg(1600, 900),
          category,
        );
        expect([image.width, image.height]).toEqual([1600, 900]);
        expect([thumbnail?.width, thumbnail?.height]).toEqual([400, 225]);
        expect(thumbnail?.mimeType).toBe('image/webp');
      }
    });

    it('skips the thumbnail when the image is already that narrow', async () => {
      const { thumbnail } = await processImage(
        await jpeg(400, 300),
        ImageCategory.NEWS,
      );
      expect(thumbnail).toBeNull();
    });

    it('makes none for profile pictures', async () => {
      const { thumbnail } = await processImage(
        await jpeg(1200, 1200),
        ImageCategory.PROFILE,
      );
      expect(thumbnail).toBeNull();
    });
  });

  describe('metadata', () => {
    it('rotates by EXIF orientation, then drops all EXIF', async () => {
      // Orientation 6 = the camera was turned 90°: stored 400×200, shown 200×400.
      const rotated = await solid(400, 200)
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer();

      const result = await storedImage(rotated, ImageCategory.GENERAL);
      const stored = await sharp(result.data).metadata();

      expect([result.width, result.height]).toEqual([200, 400]);
      expect(stored.orientation).toBeUndefined();
      expect(stored.exif).toBeUndefined();
    });
  });

  describe('rejections (400 VALIDATION_ERROR)', () => {
    it('rejects an empty file', async () => {
      expect(
        await rejection(processImage(Buffer.alloc(0), ImageCategory.NEWS)),
      ).toEqual(['file is empty']);
    });

    it('rejects a file over the size limit before decoding it', async () => {
      const big = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff]),
        Buffer.alloc(10 * 1024 * 1024),
      ]);
      expect(await rejection(processImage(big, ImageCategory.NEWS))).toEqual([
        'file must be at most 10 MB',
      ]);
    });

    it.each([
      ['GIF', () => solid(8, 8).gif().toBuffer()],
      [
        'SVG',
        () =>
          Promise.resolve(
            Buffer.from(
              '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><script>alert(1)</script></svg>',
            ),
          ),
      ],
      ['plain text', () => Promise.resolve(Buffer.from('not an image'))],
    ])('rejects %s', async (_name, make) => {
      expect(
        await rejection(processImage(await make(), ImageCategory.NEWS)),
      ).toEqual(['file must be a JPEG, PNG or WebP image']);
    });

    it('rejects a PNG over 40 megapixels before decoding it', async () => {
      expect(
        await rejection(
          processImage(pngBomb(10_000, 10_000), ImageCategory.NEWS),
        ),
      ).toEqual(['PNG images must be at most 40 megapixels']);
    });

    it.each([
      [16_000, 14_000],
      // Past sharp's own default limit, still reported the same way.
      [20_000, 15_000],
    ])(
      'rejects a %ix%i JPEG over 200 megapixels before decoding it',
      async (width, height) => {
        expect(
          await rejection(
            processImage(jpegBomb(width, height), ImageCategory.NEWS),
          ),
        ).toEqual(['JPEG images must be at most 200 megapixels']);
      },
    );

    it('rejects an image whose pixel data is cut off', async () => {
      const whole = await solid(200, 200)
        .png({ compressionLevel: 0 })
        .toBuffer();
      const truncated = whole.subarray(0, Math.floor(whole.length / 2));

      expect(
        await rejection(processImage(truncated, ImageCategory.NEWS)),
      ).toEqual(['file is not a readable image']);
    });
  });
});
