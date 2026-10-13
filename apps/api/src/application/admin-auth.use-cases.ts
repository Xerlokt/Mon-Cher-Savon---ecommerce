import { DomainError } from '../domain/shared/domain-error.js';
import type {
  AdminUserRepository,
  LoginThrottle,
  PasswordHasher,
  SessionTokens,
} from '../domain/ports/index.js';

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('E-mail ou senha incorretos.');
  }
}

export class TooManyAttemptsError extends DomainError {
  constructor(readonly retryAfterSeconds: number) {
    super(`Muitas tentativas. Tente de novo em ${Math.ceil(retryAfterSeconds / 60)} minuto(s).`);
  }
}

export interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
  /** Identifies the caller (usually the IP) for rate limiting. */
  clientKey: string;
}

export interface LoginResult {
  token: string;
  maxAgeSeconds: number | null;
  adminId: string;
}

export class LoginUseCase {
  constructor(
    private readonly admins: AdminUserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionTokens,
    private readonly throttle: LoginThrottle,
    /** Hash verified when the email is unknown so both failures take the same time. */
    private readonly decoyHash = '',
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const key = `${input.clientKey}|${input.email}`;
    const wait = this.throttle.retryAfterSeconds(key);
    if (wait > 0) throw new TooManyAttemptsError(wait);

    const admin = await this.admins.findByEmail(input.email);
    const valid = await this.hasher.verify(admin?.passwordHash ?? this.decoyHash, input.password);
    if (!admin || !valid) {
      this.throttle.recordFailure(key);
      throw new InvalidCredentialsError();
    }

    this.throttle.reset(key);
    const session = await this.sessions.issue(admin.id, input.remember);
    return { ...session, adminId: admin.id };
  }
}
