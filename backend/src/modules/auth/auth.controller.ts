import { Response } from 'express';
import { Controller, Post, Body, Res } from '@nestjs/common';
import { loginSchema } from '@cineticket/shared';
import { AuthService } from './auth.service';
import {
  AuthenticateUserRequest,
  AuthenticateUserResponse,
} from './dto/login.dto';
import { AppConfigService } from '@/config/config.service';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

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
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken, user };
  }
}
