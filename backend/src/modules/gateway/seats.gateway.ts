import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SessionsService } from '@/modules/sessions/sessions.service';
import {
  JoinSessionPayload,
  SeatUpdatePayload,
} from './types/seat-update.payload';

// D40: mesma mensagem para sessão inexistente e sessão published:false — não
// vazar a diferença entre "não existe" e "existe mas é rascunho", nem para o
// organizador dono (sem exceção nesta versão).
const JOIN_REFUSED_MESSAGE =
  'Sessão indisponível para acompanhamento em tempo real.';

function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

// CORS_ORIGINS lido direto de process.env (mesma variável de env.schema.ts):
// o valor de options do decorator @WebSocketGateway é avaliado na carga do
// módulo, antes de o AppConfigService existir como provider — não dá pra
// injetar DI aqui. Fallback local espelha o default do schema.
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim());

@WebSocketGateway({ cors: { origin: allowedOrigins, credentials: true } })
export class SeatsGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(SeatsGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly sessionsService: SessionsService) {}

  @SubscribeMessage('join:session')
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinSessionPayload,
  ): Promise<void> {
    const sessionId = payload?.sessionId;

    const session = sessionId
      ? await this.sessionsService.findOne(sessionId).catch(() => null)
      : null;

    if (!session || !session.published) {
      client.emit('join:error', { message: JOIN_REFUSED_MESSAGE });
      return;
    }

    await client.join(sessionRoom(sessionId));
    client.emit('join:ack', { sessionId });
  }

  handleDisconnect(client: Socket): void {
    // socket.io já remove o client de toda room no disconnect (não há
    // estado próprio além disso a limpar).
    this.logger.debug(`Client desconectado: ${client.id}`);
  }

  emitSeatUpdate(sessionId: string, update: SeatUpdatePayload): void {
    this.server.to(sessionRoom(sessionId)).emit('seat:update', update);
  }
}
