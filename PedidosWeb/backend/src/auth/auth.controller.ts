import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { getAuthCookieName, SESSION_MAX_AGE_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Rate limit mais restritivo para login: 10 tentativas por 15 minutos
  @Throttle({ default: { ttl: 900_000, limit: 10 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const token = await this.auth.signSessionToken(dto);
    const name = getAuthCookieName();
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(name, token, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_MS,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
    });
    return { ok: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    const name = getAuthCookieName();
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(name, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
    });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: { userId: string } }) {
    return { userId: req.user.userId };
  }
}
