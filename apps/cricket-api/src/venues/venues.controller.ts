import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiVenueIdParam } from '../common/swagger.decorators.js';
import { VenueDto } from './dto/venue.dto.js';
import { VenuesService } from './venues.service.js';

@ApiTags('venues')
@Controller('venues')
export class VenuesController {
  constructor(@Inject(VenuesService) private readonly venuesService: VenuesService) {}

  @Get(':venueId')
  @ApiOperation({ summary: 'Get venue usage summary' })
  @ApiVenueIdParam()
  @ApiOkResponse({ type: VenueDto })
  getVenue(@Param('venueId') venueId: string) {
    return this.venuesService.getById(venueId);
  }
}
