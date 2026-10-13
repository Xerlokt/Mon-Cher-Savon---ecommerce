import { describe, expect, it } from 'vitest';
import { assertSafeToReset } from './demo-guard.js';

const url = 'postgresql://u:p@host:5432/savon_demo';

describe('assertSafeToReset', () => {
  it('allows only an explicitly confirmed demo database', () => {
    expect(
      assertSafeToReset({
        DEMO_MODE: 'true',
        DATABASE_URL: url,
        DEMO_CONFIRM_DB_NAME: 'savon_demo',
      }),
    ).toBe('savon_demo');
  });

  it('refuses without demo mode, without a URL or with the wrong confirmation', () => {
    expect(() =>
      assertSafeToReset({ DATABASE_URL: url, DEMO_CONFIRM_DB_NAME: 'savon_demo' }),
    ).toThrow(/DEMO_MODE/);
    expect(() => assertSafeToReset({ DEMO_MODE: 'true' })).toThrow(/DATABASE_URL/);
    expect(() =>
      assertSafeToReset({
        DEMO_MODE: 'true',
        DATABASE_URL: url,
        DEMO_CONFIRM_DB_NAME: 'production',
      }),
    ).toThrow(/DEMO_CONFIRM_DB_NAME/);
    expect(() => assertSafeToReset({ DEMO_MODE: 'true', DATABASE_URL: url })).toThrow(
      /DEMO_CONFIRM_DB_NAME/,
    );
  });
});
