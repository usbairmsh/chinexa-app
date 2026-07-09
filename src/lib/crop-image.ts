import type { Area } from "react-easy-crop";

/** Loads an image element from an object/data URL — needed before drawing it to canvas. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Renders the user's crop selection to a canvas and returns it as a JPEG blob. */
async function renderCroppedCanvas(imageSrc: string, cropArea: Area, quality: number): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(
    image,
    cropArea.x, cropArea.y, cropArea.width, cropArea.height,
    0, 0, cropArea.width, cropArea.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image"))), "image/jpeg", quality);
  });
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Crops the image to the selected area and guarantees the result is under
 * 5MB — the server enforces the same cap, but re-encoding here up front
 * avoids a round-trip rejection for a large source photo (e.g. a modern
 * phone camera shot can be 10-20MB before cropping).
 */
export async function getCroppedImageBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  let quality = 0.92;
  let blob = await renderCroppedCanvas(imageSrc, cropArea, quality);
  while (blob.size > MAX_AVATAR_BYTES && quality > 0.35) {
    quality -= 0.12;
    blob = await renderCroppedCanvas(imageSrc, cropArea, quality);
  }
  return blob;
}
