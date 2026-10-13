import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ChannelDeliveryFailure, TelegramChannel } from './telegram.channel.js';
import { WhatsAppChannel, toTemplateVariable } from './whatsapp.channel.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('TelegramChannel', () => {
  const channel = new TelegramChannel({ botToken: 'SECRET:TOKEN', baseUrl: 'https://tg.test' });

  it('posts the message to the chat id', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post('https://tg.test/botSECRET:TOKEN/sendMessage', async ({ request }) => {
        body = (await request.json()) as never;
        return HttpResponse.json({ ok: true });
      }),
    );
    await channel.send({ text: 'Nova venda!' }, '123456');
    expect(body).toMatchObject({ chat_id: '123456', text: 'Nova venda!' });
  });

  it('fails without leaking the token when Telegram rejects the request', async () => {
    server.use(
      http.post('https://tg.test/botSECRET:TOKEN/sendMessage', () =>
        HttpResponse.json({ ok: false }, { status: 400 }),
      ),
    );
    const error = await channel.send({ text: 'x' }, '1').catch((e: Error) => e);
    expect(error).toBeInstanceOf(ChannelDeliveryFailure);
    expect((error as Error).message).toContain('400');
    expect((error as Error).message).not.toContain('SECRET');
  });

  it('wraps network failures without leaking the token', async () => {
    server.use(
      http.post('https://tg.test/botSECRET:TOKEN/sendMessage', () => HttpResponse.error()),
    );
    const error = (await channel.send({ text: 'x' }, '1').catch((e: Error) => e)) as Error;
    expect(error).toBeInstanceOf(ChannelDeliveryFailure);
    expect(error.message).not.toContain('SECRET');
  });
});

describe('WhatsAppChannel', () => {
  const channel = new WhatsAppChannel({
    accessToken: 'WA-TOKEN',
    phoneNumberId: '555',
    templateName: 'nova_venda',
    baseUrl: 'https://wa.test',
  });

  it('sends the approved template with a single-line variable', async () => {
    let captured: { auth: string | null; body: Record<string, unknown> } | undefined;
    server.use(
      http.post('https://wa.test/555/messages', async ({ request }) => {
        captured = {
          auth: request.headers.get('authorization'),
          body: (await request.json()) as never,
        };
        return HttpResponse.json({ messages: [{ id: 'wamid' }] });
      }),
    );
    await channel.send({ text: 'Nova venda!\n2x Lavanda\n\nTotal: R$ 10' }, '5511912345678');
    expect(captured?.auth).toBe('Bearer WA-TOKEN');
    expect(captured?.body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '5511912345678',
      type: 'template',
      template: {
        name: 'nova_venda',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: 'Nova venda! | 2x Lavanda | Total: R$ 10' }],
          },
        ],
      },
    });
  });

  it('fails with a safe error on API errors and network failures', async () => {
    server.use(
      http.post('https://wa.test/555/messages', () => new HttpResponse(null, { status: 401 })),
    );
    const error = (await channel.send({ text: 'x' }, '1').catch((e: Error) => e)) as Error;
    expect(error).toBeInstanceOf(ChannelDeliveryFailure);
    expect(error.message).not.toContain('WA-TOKEN');

    server.use(http.post('https://wa.test/555/messages', () => HttpResponse.error()));
    await expect(channel.send({ text: 'x' }, '1')).rejects.toBeInstanceOf(ChannelDeliveryFailure);
  });
});

describe('toTemplateVariable', () => {
  it('removes line breaks, tabs and repeated spaces and truncates', () => {
    expect(toTemplateVariable('a\n\nb\t\tc    d')).toBe('a | b c d');
    expect(toTemplateVariable('x'.repeat(2000))).toHaveLength(1024);
  });
});
