import { describe, expect, it } from 'vitest';
import { Money } from '../domain/shared/money.js';
import { anOrder } from '../domain/order/testing/order.builder.js';
import { NotifySaleUseCase, formatPhone, formatSaleMessage } from './notify-sale.use-case.js';
import { FakeChannel, FakeNotificationLog, FakeNotificationSettings } from './testing/fakes.js';

const order = () =>
  anOrder()
    .withItem({ unitPrice: Money.cents(1800), quantity: 2, productName: 'Sabonete de Lavanda' })
    .withItem({
      unitPrice: Money.cents(2200),
      quantity: 1,
      productName: 'Sabonete de Argila Verde',
    })
    .withShipping(Money.cents(1000))
    .paid()
    .build();

describe('formatSaleMessage', () => {
  it('lists items, totals and delivery address', () => {
    const text = formatSaleMessage(order(), 'https://loja.test').text;
    expect(text).toContain('Nova venda! Pedido #A7K2');
    expect(text).toContain('2x Sabonete de Lavanda');
    expect(text).toContain('1x Sabonete de Argila Verde');
    expect(text).toContain('Rua das Flores, 120, ap. 3');
    expect(text).toContain('https://loja.test/painel/vendas/A7K2');
  });
});

describe('formatPhone', () => {
  it('formats Brazilian mobile and landline numbers and leaves others untouched', () => {
    expect(formatPhone('11912345678')).toBe('(11) 91234-5678');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('+1 555')).toBe('+1 555');
  });
});

describe('NotifySaleUseCase', () => {
  it('sends the destination saved for each channel', async () => {
    const telegram = new FakeChannel('telegram');
    await new NotifySaleUseCase(
      [telegram],
      new FakeNotificationSettings(['telegram'], { telegram: '555' }),
      new FakeNotificationLog(),
      'x',
    ).execute(order());
    expect(telegram.sent[0]?.destination).toBe('555');
  });

  it('sends only through enabled channels and survives a failing one', async () => {
    const telegram = new FakeChannel('telegram');
    const whatsapp = new FakeChannel('whatsapp', true);
    const log = new FakeNotificationLog();
    const useCase = new NotifySaleUseCase(
      [telegram, whatsapp],
      new FakeNotificationSettings(['telegram', 'whatsapp']),
      log,
      'https://loja.test',
    );
    await useCase.execute(order());
    expect(telegram.sent).toHaveLength(1);
    expect(log.records[0]?.ok).toEqual([true, false]);
  });

  it('skips disabled channels', async () => {
    const telegram = new FakeChannel('telegram');
    const log = new FakeNotificationLog();
    await new NotifySaleUseCase([telegram], new FakeNotificationSettings([]), log, 'x').execute(
      order(),
    );
    expect(telegram.sent).toHaveLength(0);
  });

  it('fails when every enabled channel fails so the outbox retries', async () => {
    const useCase = new NotifySaleUseCase(
      [new FakeChannel('telegram', true)],
      new FakeNotificationSettings(['telegram']),
      new FakeNotificationLog(),
      'x',
    );
    await expect(useCase.execute(order())).rejects.toThrow(/canais/);
  });
});
