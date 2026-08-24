import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createSessionSchema, updateSessionSchema } from '@cineticket/shared';
import { Session } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { OptionalCurrentUser } from '@/common/decorators/optional-current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '@/common/guards/role.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthenticatedUserRole } from '@/common/types/authenticated-request.type';
import { SessionsService, SessionWithMovie } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Lista sessões (acesso público, sem login) — rascunho só aparece pro organizador dono',
  })
  findAll(
    @OptionalCurrentUser() user: AuthenticatedUserRole | null,
  ): Promise<SessionWithMovie[]> {
    return this.sessionsService.findAll(user?.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Detalhe de uma sessão (acesso público) — 404 se rascunho e quem pede não é o dono',
  })
  findOne(
    @Param('id') id: string,
    @OptionalCurrentUser() user: AuthenticatedUserRole | null,
  ): Promise<SessionWithMovie> {
    return this.sessionsService.findOne(id, user?.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cria sessão (organizador)' })
  create(
    @Body(new ZodValidationPipe(createSessionSchema)) dto: CreateSessionDto,
    @CurrentUser() user: AuthenticatedUserRole,
  ): Promise<Session> {
    return this.sessionsService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edita sessão própria (organizador dono)' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSessionSchema)) dto: UpdateSessionDto,
    @CurrentUser() user: AuthenticatedUserRole,
  ): Promise<Session> {
    return this.sessionsService.update(id, dto, user.id);
  }
}
