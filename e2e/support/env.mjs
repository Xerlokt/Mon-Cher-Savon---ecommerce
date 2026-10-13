// Single source of truth for the E2E stack (ports, secrets, database). Nothing here is a real secret.
export const PORTS = { web: 3100, api: 3101, mock: 4020 };

export const E2E = {
  databaseUrl:
    process.env.E2E_DATABASE_URL ?? 'postgresql://savon:savon@localhost:5432/mon_cher_savon_e2e',
  sessionSecret: 'e2e-session-secret-0123456789-abcdefghijklmnop',
  webhookSecret: 'e2e-webhook-secret',
  adminEmail: 'vendedora@example.com',
  adminPassword: 'senha-e2e-segura-123',
  telegramToken: '111:e2e-token',
  webUrl: `http://localhost:${PORTS.web}`,
  apiUrl: `http://localhost:${PORTS.api}`,
  mockUrl: `http://127.0.0.1:${PORTS.mock}`,
};

export function apiEnv() {
  return {
    ...process.env,
    npm_config_verify_deps_before_run: 'false',
    DATABASE_URL: E2E.databaseUrl,
    API_PORT: String(PORTS.api),
    API_PUBLIC_URL: E2E.apiUrl,
    WEB_ORIGIN: E2E.webUrl,
    SESSION_SECRET: E2E.sessionSecret,
    PAYMENT_MODE: 'mercadopago',
    MERCADOPAGO_ACCESS_TOKEN: 'TEST-e2e',
    MERCADOPAGO_WEBHOOK_SECRET: E2E.webhookSecret,
    MERCADOPAGO_API_BASE_URL: E2E.mockUrl,
    TELEGRAM_BOT_TOKEN: E2E.telegramToken,
    TELEGRAM_API_BASE_URL: E2E.mockUrl,
    OUTBOX_POLL_MS: '500',
    ENABLE_DOCS: 'false',
    UPLOAD_DIR: './uploads-e2e',
    NODE_ENV: 'production',
    COOKIE_SECURE: 'false',
  };
}

export function webEnv() {
  return {
    ...process.env,
    npm_config_verify_deps_before_run: 'false',
    API_URL: E2E.apiUrl,
    SITE_URL: E2E.webUrl,
    SESSION_SECRET: E2E.sessionSecret,
  };
}
