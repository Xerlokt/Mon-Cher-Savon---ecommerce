/**
 * The public demo is wiped and reseeded daily. This guard makes that impossible to point at a real
 * database by accident: it needs DEMO_MODE=true AND the exact database name typed again in
 * DEMO_CONFIRM_DB_NAME.
 */
export function assertSafeToReset(env: Record<string, string | undefined>): string {
  if (env['DEMO_MODE'] !== 'true')
    throw new Error('DEMO_MODE=true is required to reset the demo database.');
  const url = env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set.');
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName || env['DEMO_CONFIRM_DB_NAME'] !== dbName) {
    throw new Error(
      `DEMO_CONFIRM_DB_NAME must equal the database name ("${dbName}") to confirm the reset.`,
    );
  }
  return dbName;
}
