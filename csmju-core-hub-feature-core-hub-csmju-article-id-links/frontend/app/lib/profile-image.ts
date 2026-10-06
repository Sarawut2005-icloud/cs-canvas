/** Client-safe rules and helpers for profile pictures. */

export const MAX_PROFILE_IMAGE_BYTES = 1024 * 1024;
export const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png"];

/** Same-origin URL of a profile picture, or null without one. */
export function profileImageUrl(imageId: string | null | undefined): string | null {
  return imageId ? `/api/profile-image/${encodeURIComponent(imageId)}` : null;
}

/** The Core API crops avatars to 512px, so a bigger source gains nothing. */
const MAX_SIDE = 1024;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable image"));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Returns the file unchanged when it is already within 1 MB; otherwise
 * re-encodes it as JPEG, lowering the quality and then the size until it
 * fits. Returns null when the image cannot be made small enough.
 */
export async function shrinkToLimit(
  file: File,
  maxBytes = MAX_PROFILE_IMAGE_BYTES,
): Promise<File | null> {
  if (file.size <= maxBytes) return file;

  const img = await loadImage(file);
  let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    // JPEG has no transparency — a transparent PNG gets a white background.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const blob = await toBlob(canvas, quality);
      if (blob && blob.size <= maxBytes) {
        const name = file.name.replace(/\.[^.]+$/, "") || "profile";
        return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
      }
    }
    scale *= 0.75;
  }
  return null;
}
