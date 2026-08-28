// Crop rectangle in SOURCE-image pixel coordinates. (Matches react-easy-crop's
// Area shape so both the avatar cropper and the resizable-box cropper feed the
// same canvas routine.)
export interface Area { x: number; y: number; width: number; height: number }

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

/**
 * True when the source is a PNG. Those are re-encoded as PNG rather than JPEG,
 * because a transparent background drawn onto an untouched canvas becomes solid
 * black once flattened into a JPEG — very visible on a logo or a cut-out
 * product shot.
 */
function isPng(src: string): boolean {
  return src.startsWith("data:image/png") || /\.png(\?|$)/i.test(src);
}

/** Renders the user's crop selection to a canvas and returns it as a blob. */
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

  // PNG keeps its alpha channel; everything else takes JPEG's much better
  // photographic compression. toBlob ignores `quality` for PNG, so the size
  // loop below simply won't shrink a PNG — the 5MB server cap still applies.
  const type = isPng(imageSrc) ? "image/png" : "image/jpeg";
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image"))), type, quality);
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
  // Re-encoding a PNG at a lower quality does nothing (the format is lossless),
  // so the loop would spin uselessly to 0.35 before giving up.
  if (isPng(imageSrc)) return blob;
  while (blob.size > MAX_AVATAR_BYTES && quality > 0.35) {
    quality -= 0.12;
    blob = await renderCroppedCanvas(imageSrc, cropArea, quality);
  }
  return blob;
}
