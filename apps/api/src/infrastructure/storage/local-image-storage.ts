import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImageStorage } from '../../domain/ports/index.js';

export type ImageExtension = 'jpg' | 'png' | 'webp';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Detects the real image type from magic bytes; the client-provided mimetype is never trusted. */
export function detectImageExtension(data: Buffer): ImageExtension | null {
  if (data.length > MAX_IMAGE_BYTES) return null;
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpg';
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/** Development/demo storage on local disk. Swap for an object-storage adapter (R2/Cloudinary) in production. */
export class LocalDiskImageStorage implements ImageStorage {
  constructor(
    private readonly directory: string,
    private readonly publicPath = '/uploads',
  ) {}

  async save(data: Buffer, extension: ImageExtension): Promise<{ url: string }> {
    await mkdir(this.directory, { recursive: true });
    const name = `${randomBytes(12).toString('hex')}.${extension}`;
    await writeFile(join(this.directory, name), data);
    return { url: `${this.publicPath}/${name}` };
  }
}
