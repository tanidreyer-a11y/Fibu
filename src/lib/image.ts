/**
 * Shrinks a camera photo to a JPEG data URL small enough for the AI proxy.
 * A raw iPhone photo is 3–6 MB, which blows past the server's body limit and
 * makes vision calls slow; ~1024px keeps every detail the model can use.
 * Drawing through an <img> applies the EXIF rotation, so portrait shots stay upright.
 */
export async function photoToDataUrl(file: Blob, maxDim = 1024, quality = 0.8): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error("That photo format can't be read here — try taking the photo again or use a screenshot.");
    }

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Couldn't process that photo on this device.");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
