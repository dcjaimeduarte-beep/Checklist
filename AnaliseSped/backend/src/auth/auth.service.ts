import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  /**
   * Valida credenciais e devolve o JWT (para gravar em cookie HttpOnly no controller).
   */
  async signSessionToken(dto: LoginDto): Promise<string> {
    const user = process.env.AUTH_LOGIN_USERNAME ?? '';
    const pass = process.env.AUTH_LOGIN_PASSWORD ?? '';
    if (!user || !pass) {
      throw new UnauthorizedException('Autenticação não configurada no servidor.');
    }
    if (dto.username !== user || dto.password !== pass) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const payload = { sub: dto.username, role: 'user' };
    return this.jwt.signAsync(payload);
  }
}
