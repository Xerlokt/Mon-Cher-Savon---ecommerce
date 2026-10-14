import { createHash } from 'node:crypto';
import type { ImageStorage } from '../../domain/ports/index.js';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  /** Override only for tests. */
  baseUrl?: string;
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

/** Production storage: signed server-side upload to Cloudinary. Errors never carry credentials. */
export class CloudinaryImageStorage implements ImageStorage {
  private readonly baseUrl: string;

  constructor(private readonly config: CloudinaryConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.cloudinary.com';
  }

  async save(data: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<{ url: string }> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const { folder, apiKey, apiSecret, cloudName } = this.config;
    // Cloudinary signs the sorted "key=value" params (excluding file/api_key) plus the secret.
    const signature = createHash('sha1')
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(data)], { type: MIME[extension] }));
    form.set('api_key', apiKey);
    form.set('timestamp', timestamp);
    form.set('folder', folder);
    form.set('signature', signature);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: form,
      });
    } catch {
      throw new Error('Falha ao enviar imagem ao Cloudinary');
    }
    if (!res.ok) throw new Error(`Falha ao enviar imagem ao Cloudinary (HTTP ${res.status})`);
    const body = (await res.json().catch(() => null)) as { secure_url?: unknown } | null;
    if (typeof body?.secure_url !== 'string') {
      throw new Error('Resposta inesperada do Cloudinary');
    }
    return { url: body.secure_url };
  }
}
