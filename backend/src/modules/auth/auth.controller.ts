import { Request, Response } from 'express';
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { loginSchema, userSchema } from '@cineticket/shared';
import { AuthService } from './auth.service';
import {
  AuthenticateUserRequest,
  AuthenticateUserResponse,
} from './dto/login.dto';
import { RegisterUserRequest, RegisterUserResponse } from './dto/register.dto';
import { AppConfigService } from '@/config/config.service';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

const REFRESH_TOKEN_COOKIE = 'refreshToken';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: AuthenticateUserRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthenticateUserResponse> {
    const { accessToken, refreshToken, user } = await this.authService.login(
      dto.email,
      dto.password,
    );
    this.setRefreshTokenCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(userSchema)) dto: RegisterUserRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RegisterUserResponse> {
    const { accessToken, refreshToken, user } =
      await this.authService.register(dto);
    this.setRefreshTokenCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthenticateUserResponse> {
    const currentRefreshToken = this.readRefreshTokenCookie(req);
    if (!currentRefreshToken) {
      throw new UnauthorizedException('Refresh token ausente');
    }

    const { accessToken, refreshToken, user } =
      await this.authService.refresh(currentRefreshToken);
    this.setRefreshTokenCookie(res, refreshToken);
    return { accessToken, user };
  }

  // Invalidação server-side real (não só limpeza de estado no cliente):
  // zera User.refreshTokenHash pra que o cookie que o navegador ainda tenha
  // pare de funcionar em /auth/refresh. Sem guard — precisa funcionar mesmo
  // com access token já expirado, cenário comum de "sessão ociosa, usuário
  // clica em sair". Idempotente: sem cookie, ou com assinatura inválida,
  // ainda retorna 200 (cookie é limpo de qualquer forma), só não há hash
  // pra zerar.
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const currentRefreshToken = this.readRefreshTokenCookie(req);
    await this.authService.logout(currentRefreshToken);
    this.clearRefreshTokenCookie(res);
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: this.config.nodeEnv === 'production',
      sameSite: 'lax',
    });
  }

  private readRefreshTokenCookie(req: Request): string | undefined {
    return req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
  }
}
