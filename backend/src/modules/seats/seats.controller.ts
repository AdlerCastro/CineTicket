import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalCurrentUser } from '@/common/decorators/optional-current-user.decorator';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard';
import { AuthenticatedUserRole } from '@/common/types/authenticated-request.type';
import { SeatsService } from './seats.service';
import { SeatMapItem } from './dto/seat-map-item.dto';

@ApiTags('seats')
@Controller('sessions/:sessionId/seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Mapa de assentos de uma sessão (acesso público, sem login) — segue a mesma regra published/dono da sessão',
  })
  findAll(
    @Param('sessionId') sessionId: string,
    @OptionalCurrentUser() user: AuthenticatedUserRole | null,
  ): Promise<SeatMapItem[]> {
    return this.seatsService.getSeatMap(sessionId, user?.id);
  }
}
