import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import { ImageCategory } from '../../../generated/prisma/client';
import {
  IMAGE_RULES,
  MAX_INPUT_PIXELS,
  OUTPUT_FORMAT,
  ResizeRule,
} from './image-rules';

export type SourceFormat = 'jpeg' | 'png' | 'webp';

export interface EncodedImage {
  data: Buffer;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface ProcessedImage {
  image: EncodedImage;
  /** Null when the category has none or the image is no wider than it. */
  thumbnail: EncodedImage | null;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 * Identifies the file from its first bytes. The client's file name and
 * Content-Type are never trusted — anything else (SVG, GIF, HTML renamed to
 * .jpg, ...) returns null.
 */
export function sniffFormat(data: Buffer): SourceFormat | null {
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return 'jpeg';
  }
  if (data.length >= 8 && data.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'png';
  }
  if (
    data.length >= 12 &&
    data.toString('latin1', 0, 4) === 'RIFF' &&
    data.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/** 400 VALIDATION_ERROR — the filter maps an array message to that code. */
function reject(message: string): never {
  throw new BadRequestException([message]);
}

function applyResize(
  image: sharp.Sharp,
  rule: ResizeRule,
  width: number,
  height: number,
): sharp.Sharp {
  switch (rule.fit) {
    case 'square': {
      const side = Math.min(rule.size, width, height);
      return image.resize(side, side, { fit: 'cover', position: 'centre' });
    }
    case 'width':
      return image.resize({ width: rule.maxWidth, withoutEnlargement: true });
    case 'inside':
      return image.resize({
        width: rule.maxSide,
        height: rule.maxSide,
        fit: 'inside',
        withoutEnlargement: true,
      });
  }
}

async function encode(pipeline: sharp.Sharp): Promise<EncodedImage> {
  const { data, info } = await pipeline
    .webp({ quality: OUTPUT_FORMAT.quality })
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    mimeType: OUTPUT_FORMAT.mimeType,
    sizeBytes: info.size,
    width: info.width,
    height: info.height,
  };
}

/**
 * Validates an upload and re-encodes it for storage: rotated upright from
 * its EXIF orientation, scaled down to the category's limit and written as
 * WebP, plus a thumbnail where the category has one. Re-encoding drops all
 * metadata, so camera EXIF (including GPS location) never reaches the
 * stored file.
 */
export async function processImage(
  input: Buffer,
  category: ImageCategory,
): Promise<ProcessedImage> {
  const rule = IMAGE_RULES[category];

  if (input.length === 0) {
    reject('file is empty');
  }
  if (input.length > rule.maxUploadBytes) {
    reject(`file must be at most ${rule.maxUploadBytes / (1024 * 1024)} MB`);
  }

  const format = sniffFormat(input);
  if (!format) {
    reject('file must be a JPEG, PNG or WebP image');
  }

  const maxPixels = MAX_INPUT_PIXELS[format];

  let metadata: sharp.Metadata;
  try {
    // Only the header is read, so sharp's own pixel limit is lifted here to
    // report an oversized image with the message below.
    metadata = await sharp(input, { limitInputPixels: false }).metadata();
  } catch {
    reject('file is not a readable image');
  }

  if (metadata.format !== format) {
    reject('file must be a JPEG, PNG or WebP image');
  }
  // metadata() only reads the header, so the pixel limit is checked here
  // before anything is decoded.
  if (metadata.width * metadata.height > maxPixels) {
    reject(
      `${format.toUpperCase()} images must be at most ${maxPixels / 1_000_000} megapixels`,
    );
  }

  const { width, height } = metadata.autoOrient;

  let image: EncodedImage;
  try {
    image = await encode(
      applyResize(
        sharp(input, { autoOrient: true, limitInputPixels: maxPixels }),
        rule.resize,
        width,
        height,
      ),
    );
  } catch {
    // A valid header over truncated or corrupt pixel data.
    reject('file is not a readable image');
  }

  // Scaled from the stored copy, which is already small and upright.
  const thumbnail =
    rule.thumbnailWidth && image.width > rule.thumbnailWidth
      ? await encode(sharp(image.data).resize({ width: rule.thumbnailWidth }))
      : null;

  return { image, thumbnail };
}
