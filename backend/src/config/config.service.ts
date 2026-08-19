import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVars } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<EnvVars, true>) {}

  get nodeEnv(): EnvVars['NODE_ENV'] {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get jwtAccessSecret(): string {
    return this.configService.get('JWT_ACCESS_SECRET', { infer: true });
  }

  get jwtRefreshSecret(): string {
    return this.configService.get('JWT_REFRESH_SECRET', { infer: true });
  }

  get jwtTicketSecret(): string {
    return this.configService.get('JWT_TICKET_SECRET', { infer: true });
  }

  get tmdbApiKey(): string {
    return this.configService.get('TMDB_API_KEY', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.configService
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim());
  }
}
