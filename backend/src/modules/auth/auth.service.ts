import { AppConfigService } from '@/config/config.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { AuthenticatedUser } from './dto/login.dto';
import { RegisterUserRequest } from './dto/register.dto';

const BCRYPT_SALT_ROUNDS = 10; // mesmo valor usado em src/prisma/seed.ts

interface JwtPayload {
  sub: string;
  role: UserRole;
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async login(email: string, password: string): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.issueTokens(user);
  }

  async register(dto: RegisterUserRequest): Promise<IssuedTokens> {
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          name: dto.name,
          // Autocadastro público é sempre CUSTOMER, independente do que o
          // payload enviar — dto.role é ignorado de propósito (D43).
          role: UserRole.CUSTOMER,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw error;
    }

    return this.login(dto.email, dto.password);
  }

  // D58: refresh token é lido do cookie httpOnly, nunca do body. Rotaciona a
  // cada uso (novo refresh token + novo hash substituindo o anterior) — mais
  // seguro que reemitir o mesmo, e não é custo extra real já que um novo par
  // de tokens já precisa ser assinado de qualquer forma.
  async refresh(refreshToken: string): Promise<IssuedTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (!this.refreshTokenMatches(refreshToken, user.refreshTokenHash)) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    return this.issueTokens(user);
  }

  // Invalidação server-side real de logout: zera refreshTokenHash pra que o
  // cookie que o cliente ainda guarda pare de funcionar em /auth/refresh,
  // mesmo antes dos 7 dias naturais de expiração do JWT. Idempotente de
  // propósito — sem cookie, ou com assinatura inválida, não é erro (401),
  // só não há usuário confiável pra invalidar; a mesma verificação de
  // assinatura do refresh evita que um valor forjado zere o hash de outro
  // usuário (ignoreExpiration: true porque logout deve funcionar mesmo com
  // o refresh token já expirado — o objetivo é limpar o estado, não validar
  // sessão ativa).
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.jwtRefreshSecret,
        ignoreExpiration: true,
      });
    } catch {
      return;
    }

    await this.prisma.user.updateMany({
      where: { id: payload.sub },
      data: { refreshTokenHash: null },
    });
  }

  private async issueTokens(user: User): Promise<IssuedTokens> {
    const payload: JwtPayload = { sub: user.id, role: user.role };

    // jti aleatório: sem isso, dois sign() com o mesmo payload dentro do
    // mesmo segundo (iat com resolução de 1s) produzem o token byte-a-byte
    // idêntico — a rotação de refresh token em /auth/refresh silenciosamente
    // vira um no-op quando chamada rápido o bastante (achado real, pego por
    // teste e2e rodando refresh duas vezes em sequência).
    const accessToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      { secret: this.config.jwtAccessSecret, expiresIn: '15m' },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      { secret: this.config.jwtRefreshSecret, expiresIn: '7d' },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: this.hashRefreshToken(refreshToken) },
    });

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  // SHA-256, não bcrypt: bcrypt trunca o input em 72 bytes, mais curto que
  // um JWT típico — dois refresh tokens do mesmo usuário podem compartilhar
  // header+payload e colidir num bcrypt.compare falso-positivo. O token já
  // carrega entropia criptográfica própria (assinado), então o hash lento
  // do bcrypt (pensado para senha de baixa entropia) não agrega nada aqui.
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshTokenMatches(token: string, storedHash: string): boolean {
    const candidate = Buffer.from(this.hashRefreshToken(token));
    const stored = Buffer.from(storedHash);
    return (
      candidate.length === stored.length && timingSafeEqual(candidate, stored)
    );
  }

  private sanitizeUser(user: User): AuthenticatedUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshTokenHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}
