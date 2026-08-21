import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SeatsService } from './seats.service';
import { SeatMapItem } from './dto/seat-map-item.dto';

@ApiTags('seats')
@Controller('sessions/:sessionId/seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Get()
  @ApiOperation({
    summary: 'Mapa de assentos de uma sessão (acesso público, sem login)',
  })
  findAll(@Param('sessionId') sessionId: string): Promise<SeatMapItem[]> {
    return this.seatsService.getSeatMap(sessionId);
  }
}
