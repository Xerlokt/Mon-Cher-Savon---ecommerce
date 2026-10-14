import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudinaryImageStorage } from './cloudinary-image-storage.js';

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(20),
]);
const config = {
  cloudName: 'demo',
  apiKey: '123',
  apiSecret: 'shh-secret',
  folder: 'mon-cher-savon',
  baseUrl: 'http://cloudinary.test',
};

afterEach(() => vi.unstubAllGlobals());

describe('CloudinaryImageStorage', () => {
  it('uploads with a signed multipart request and returns the secure url', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo/a.png' }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const result = await new CloudinaryImageStorage(config).save(png, 'png');

    expect(result.url).toBe('https://res.cloudinary.com/demo/a.png');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://cloudinary.test/v1_1/demo/image/upload');
    const form = init.body as FormData;
    expect(form.get('api_key')).toBe('123');
    expect(form.get('timestamp')).toBe('1700000000');
    expect(form.get('folder')).toBe('mon-cher-savon');
    expect(form.get('file')).toBeInstanceOf(Blob);
    const expected = createHash('sha1')
      .update('folder=mon-cher-savon&timestamp=1700000000shh-secret')
      .digest('hex');
    expect(form.get('signature')).toBe(expected);
    expect(JSON.stringify([...form.keys()])).not.toContain('shh-secret');
  });

  it('fails without leaking credentials when the service rejects the upload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );
    const error = await new CloudinaryImageStorage(config).save(png, 'png').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('401');
    expect((error as Error).message).not.toContain('shh-secret');
  });

  it('fails when the network is down or the response has no url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('boom shh-secret'))),
    );
    const down = await new CloudinaryImageStorage(config).save(png, 'png').catch((e: Error) => e);
    expect((down as Error).message).not.toContain('shh-secret');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
    await expect(new CloudinaryImageStorage(config).save(png, 'png')).rejects.toThrow();
  });
});
