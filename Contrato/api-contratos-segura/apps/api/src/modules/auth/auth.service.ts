import crypto from "node:crypto";
import nodemailer from "nodemailer";
import type { FastifyInstance } from "fastify";
import { env } from "../../env.js";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import type { LoginBody, RegisterBody, ForgotPasswordBody, ResetPasswordBody } from "./auth.schemas.js";
import { UserRepository } from "../users/user.repository.js";

export class AuthService {
  private readonly userRepository = new UserRepository(prisma);

  constructor(private readonly app: FastifyInstance) {}

  async login(payload: LoginBody) {
    const user = await this.userRepository.findByEmailOrName(payload.email);

    if (!user) {
      throw this.app.httpErrors.unauthorized("Credenciais inválidas.");
    }

    if (user.status !== "active") {
      throw this.app.httpErrors.forbidden("Usuário inativo.");
    }

    const passwordIsValid = await verifyPassword(user.passwordHash, payload.password);
    if (!passwordIsValid) {
      throw this.app.httpErrors.unauthorized("Credenciais inválidas.");
    }

    await this.userRepository.updateLastLogin(user.id);

    const accessToken = await this.app.jwt.sign(
      {
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        revendaId: user.revendaId ?? null,
      },
      {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN
      }
    );

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        revendaId: user.revendaId ?? null,
      }
    };
  }

  async register(payload: RegisterBody) {
    const existing = await this.userRepository.findByEmail(payload.email);
    if (existing) {
      throw this.app.httpErrors.conflict("Já existe uma conta com este e-mail.");
    }

    const passwordHash = await hashPassword(payload.password);
    const user = await prisma.user.create({
      data: {
        name: payload.name.trim(),
        email: payload.email.toLowerCase(),
        passwordHash,
        role: "operador",
        status: "active",
      },
    });

    const accessToken = await this.app.jwt.sign(
      { sub: user.id, name: user.name, email: user.email, role: user.role, revendaId: null },
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );

    return { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }

  async forgotPassword(payload: ForgotPasswordBody) {
    const user = await this.userRepository.findByEmail(payload.email);
    // Não revela se o e-mail existe ou não
    if (!user || user.status !== "active") return;

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

    const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const smtpUser = process.env["BACKUP_EMAIL_USER"] ?? "";
    const smtpPass = process.env["BACKUP_EMAIL_PASS"] ?? "";
    if (!smtpUser || !smtpPass) return;

    const transporter = nodemailer.createTransport({
      host:   process.env["BACKUP_EMAIL_HOST"] ?? "smtp.gmail.com",
      port:   Number(process.env["BACKUP_EMAIL_PORT"] ?? 587),
      secure: false,
      auth:   { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from:    process.env["BACKUP_EMAIL_FROM"] ?? smtpUser,
      to:      user.email,
      subject: "Redefinição de senha — Gestão de Contratos Seven",
      html: `
        <p>Olá, <strong>${user.name}</strong>.</p>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p><a href="${resetUrl}" style="background:#1B7A8C;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Redefinir senha</a></p>
        <p style="color:#888;font-size:12px">Link válido por 1 hora. Se não solicitou, ignore este e-mail.</p>
      `,
    });
  }

  async resetPassword(payload: ResetPasswordBody) {
    const record = await prisma.passwordResetToken.findUnique({ where: { token: payload.token } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw this.app.httpErrors.badRequest("Token inválido ou expirado.");
    }

    const passwordHash = await hashPassword(payload.password);
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  }
}
