import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service.js';
import {
  PlayerPerformancesDto,
  PlayerPerformancesQueryDto,
  PlayerRankingsDto,
  PlayerRankingsQueryDto,
  PlayerVsBowlingDto,
  PlayerVsBowlingQueryDto,
} from './dto/analytics.dto.js';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('player-rankings')
  @ApiOperation({
    summary:
      'Rank players by runs/wickets/etc with team, format, season, and window filters',
  })
  @ApiOkResponse({ type: PlayerRankingsDto })
  playerRankings(@Query() query: PlayerRankingsQueryDto) {
    return this.analyticsService.getPlayerRankings(query);
  }

  @Get('player-vs-bowling')
  @ApiOperation({
    summary:
      'Batter vs bowling type (pace/spin/left-arm pace): dismissals, ball stats, struggle flag',
  })
  @ApiOkResponse({ type: PlayerVsBowlingDto })
  playerVsBowling(@Query() query: PlayerVsBowlingQueryDto) {
    return this.analyticsService.getPlayerVsBowling(query);
  }

  @Get('player-performances')
  @ApiOperation({
    summary: 'Fixture-level best/worst/recent batting or bowling performances',
  })
  @ApiOkResponse({ type: PlayerPerformancesDto })
  playerPerformances(@Query() query: PlayerPerformancesQueryDto) {
    return this.analyticsService.getPlayerPerformances(query);
  }
}
