import { ImageCategory } from '../../../generated/prisma/client';

const MB = 1024 * 1024;

/**
 * How an upload is scaled down. Images smaller than the limit are never
 * enlarged.
 *   - `square`: centre-cropped to a square no larger than `size` (avatars).
 *   - `width`:  width capped at `maxWidth`, height follows the aspect ratio.
 *   - `inside`: the longer side capped at `maxSide`.
 */
export type ResizeRule =
  | { fit: 'square'; size: number }
  | { fit: 'width'; maxWidth: number }
  | { fit: 'inside'; maxSide: number };

export interface CategoryRule {
  /** Folder under UPLOAD_DIR. */
  folder: string;
  /** Largest file accepted before resizing. */
  maxUploadBytes: number;
  resize: ResizeRule;
  /** Width of the list-page copy; none when omitted. */
  thumbnailWidth?: number;
}

export const IMAGE_RULES: Record<ImageCategory, CategoryRule> = {
  // 256px avatars on a 2x screen.
  [ImageCategory.PROFILE]: {
    folder: 'profiles',
    maxUploadBytes: 10 * MB,
    resize: { fit: 'square', size: 512 },
  },
  // Full HD — the widest a news hero is shown. Tall infographics keep their
  // height.
  [ImageCategory.NEWS]: {
    folder: 'news',
    maxUploadBytes: 10 * MB,
    resize: { fit: 'width', maxWidth: 1920 },
    thumbnailWidth: 400,
  },
  [ImageCategory.GENERAL]: {
    folder: 'general',
    maxUploadBytes: 10 * MB,
    resize: { fit: 'inside', maxSide: 1920 },
    thumbnailWidth: 400,
  },
};

/** Upper bound across every category — the multipart parser's hard limit. */
export const MAX_UPLOAD_BYTES = Math.max(
  ...Object.values(IMAGE_RULES).map((rule) => rule.maxUploadBytes),
);

/**
 * Largest source image decoded, in pixels, by format. A small file can
 * declare huge dimensions (a decompression bomb) and exhaust memory while
 * decoding.
 *
 * JPEG may be larger: libvips shrinks it while decoding (shrink-on-load),
 * so memory barely grows with its size. Measured with sharp 0.35 / libvips
 * 8.18, one conversion added at most ~60 MB to RSS (under 130 MB for the
 * whole process) from 50 MP to 200 MP, EXIF-rotated files included.
 * 200 MP covers the largest phone cameras. PNG and WebP are decoded at
 * full size and keep the lower limit.
 */
export const MAX_INPUT_PIXELS = {
  jpeg: 200_000_000,
  png: 40_000_000,
  webp: 40_000_000,
} as const;

/** Every stored image is re-encoded to this, whatever was uploaded. */
export const OUTPUT_FORMAT = {
  mimeType: 'image/webp',
  extension: 'webp',
  quality: 80,
} as const;
