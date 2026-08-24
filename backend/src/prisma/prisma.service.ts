import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// D35: conexão inicial síncrona sem retry crasha (P1001) se o Postgres não
// estiver pronto exatamente quando o container sobe (risco real de
// crash-loop no Railway). Poucas tentativas com backoff crescente cobrem o
// caso de timing entre containers subindo juntos; se o banco nunca ficar
// disponível, a última tentativa relança o erro original — falha de
// configuração real (ex: DATABASE_URL errada) continua crashando de forma
// clara, não fica mascarada como se fosse só timing.
const MAX_CONNECTION_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    for (let attempt = 1; attempt <= MAX_CONNECTION_ATTEMPTS; attempt += 1) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (attempt === MAX_CONNECTION_ATTEMPTS) {
          this.logger.error(
            `Não foi possível conectar ao banco após ${MAX_CONNECTION_ATTEMPTS} tentativas — encerrando.`,
          );
          throw error;
        }

        const delayMs = INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
        this.logger.warn(
          `Tentativa ${attempt}/${MAX_CONNECTION_ATTEMPTS} de conexão ao banco falhou. Nova tentativa em ${delayMs}ms...`,
        );
        await wait(delayMs);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
