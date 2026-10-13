import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  LocalDiskImageStorage,
  MAX_IMAGE_BYTES,
  detectImageExtension,
} from './local-image-storage.js';

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(20),
]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
  Buffer.alloc(8),
]);

describe('detectImageExtension', () => {
  it('recognizes png, jpeg and webp by content', () => {
    expect(detectImageExtension(png)).toBe('png');
    expect(detectImageExtension(jpg)).toBe('jpg');
    expect(detectImageExtension(webp)).toBe('webp');
  });

  it('rejects scripts, svg, empty and oversized files', () => {
    expect(detectImageExtension(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
    expect(detectImageExtension(Buffer.from('<?php echo 1;'))).toBeNull();
    expect(detectImageExtension(Buffer.alloc(0))).toBeNull();
    expect(detectImageExtension(Buffer.concat([jpg, Buffer.alloc(MAX_IMAGE_BYTES)]))).toBeNull();
  });
});

describe('LocalDiskImageStorage', () => {
  let dir = '';
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('saves with a random name and returns a public url', async () => {
    dir = await mkdtemp(join(tmpdir(), 'mcs-img-'));
    const storage = new LocalDiskImageStorage(dir);
    const a = await storage.save(png, 'png');
    const b = await storage.save(png, 'png');
    expect(a.url).toMatch(/^\/uploads\/[0-9a-f]{24}\.png$/);
    expect(a.url).not.toBe(b.url);
    expect((await readFile(join(dir, a.url.split('/').pop() ?? ''))).equals(png)).toBe(true);
  });
});
