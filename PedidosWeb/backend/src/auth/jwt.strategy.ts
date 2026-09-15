import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { getAuthCookieName } from './auth.constants';

export type JwtPayload = { sub: string; role?: string };

function extractJwtFromCookie(req: Request): string | null {
  const name = getAuthCookieName();
  const raw = req.headers?.cookie;
  if (!raw || typeof raw !== 'string') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1].trim()) || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractJwtFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me',
    });
  }

  validate(payload: JwtPayload): { userId: string } {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }
    return { userId: payload.sub };
  }
}
