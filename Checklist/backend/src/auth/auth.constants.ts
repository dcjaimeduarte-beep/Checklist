/** Nome do cookie HttpOnly com o JWT (sessão). */
export const DEFAULT_AUTH_COOKIE_NAME = 'rt_session';

/** Sessão: 2 dias sem uso efetivo — alinhado ao `maxAge` do cookie e ao `expiresIn` do JWT. */
export const SESSION_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

export function getAuthCookieName(): string {
  return process.env.AUTH_COOKIE_NAME?.trim() || DEFAULT_AUTH_COOKIE_NAME;
}
