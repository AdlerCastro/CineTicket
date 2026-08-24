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
import { AuthenticatedUser } from './dto/login.dto';
import { RegisterUserRequest } from './dto/register.dto';

const BCRYPT_SALT_ROUNDS = 10; // mesmo valor usado em src/prisma/seed.ts

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.jwtAccessSecret,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.jwtRefreshSecret,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async register(dto: RegisterUserRequest) {
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

  private sanitizeUser(user: User): AuthenticatedUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshTokenHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}
