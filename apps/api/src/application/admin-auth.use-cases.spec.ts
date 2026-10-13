import { beforeEach, describe, expect, it } from 'vitest';
import {
  InvalidCredentialsError,
  LoginUseCase,
  TooManyAttemptsError,
} from './admin-auth.use-cases.js';
import {
  FakePasswordHasher,
  FakeSessionTokens,
  InMemoryAdmins,
  InMemoryLoginThrottle,
} from './testing/fakes.js';

describe('LoginUseCase', () => {
  let throttle: InMemoryLoginThrottle;
  let useCase: LoginUseCase;
  const input = (password: string, remember = false, email = 'ana@example.com') => ({
    email,
    password,
    remember,
    clientKey: '1.2.3.4',
  });

  beforeEach(() => {
    throttle = new InMemoryLoginThrottle(3);
    useCase = new LoginUseCase(
      new InMemoryAdmins([
        { id: 'a1', email: 'ana@example.com', passwordHash: 'hash:segredo-forte' },
      ]),
      new FakePasswordHasher(),
      new FakeSessionTokens(),
      throttle,
    );
  });

  it('issues a session for valid credentials', async () => {
    const session = await useCase.execute(input('segredo-forte'));
    expect(session).toEqual({ token: 'token:a1', maxAgeSeconds: null, adminId: 'a1' });
  });

  it('remember-me produces a persistent session', async () => {
    const session = await useCase.execute(input('segredo-forte', true));
    expect(session.maxAgeSeconds).toBe(30 * 24 * 3600);
  });

  it('rejects wrong passwords and unknown emails with the same error', async () => {
    await expect(useCase.execute(input('errada'))).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(useCase.execute(input('x', false, 'ghost@example.com'))).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('blocks after repeated failures, even with the right password, and reports the wait', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(useCase.execute(input('errada'))).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
    }
    const error = await useCase.execute(input('segredo-forte')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TooManyAttemptsError);
    expect((error as TooManyAttemptsError).retryAfterSeconds).toBeGreaterThan(0);
  });

  it('clears the failure counter after a successful login', async () => {
    await expect(useCase.execute(input('errada'))).rejects.toBeInstanceOf(InvalidCredentialsError);
    await useCase.execute(input('segredo-forte'));
    await expect(useCase.execute(input('errada'))).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(useCase.execute(input('errada'))).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(useCase.execute(input('segredo-forte'))).resolves.toBeDefined();
  });

  it('throttles per client and email, not globally', async () => {
    for (let i = 0; i < 3; i++) await useCase.execute(input('errada')).catch(() => undefined);
    await expect(
      useCase.execute({ ...input('errada'), clientKey: '9.9.9.9' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
