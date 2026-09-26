const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
export const MAX_IMAGE_BYTES = 300 * 1024;

// Turns an uploaded logo into a data URL after checking its type and content.
export async function readImage(file: File): Promise<string | null> {
  if (file.size > MAX_IMAGE_BYTES || !TYPES[file.type]) return null;
  const bytes = Buffer.from(await file.arrayBuffer());
  const head = bytes.subarray(0, 12);
  const ok =
    (file.type === 'image/png' && head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) ||
    (file.type === 'image/jpeg' && head[0] === 0xff && head[1] === 0xd8) ||
    (file.type === 'image/webp' && head.subarray(8, 12).toString() === 'WEBP') ||
    (file.type === 'image/svg+xml' && /<svg[\s>]/i.test(bytes.subarray(0, 2048).toString('utf8')));
  return ok ? `data:${file.type};base64,${bytes.toString('base64')}` : null;
}
