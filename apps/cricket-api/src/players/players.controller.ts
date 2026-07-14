import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PlayerBattingStatsDto,
  PlayerBowlingStatsDto,
  PlayerCareerDto,
  PlayerCareerQueryDto,
  PlayerCompareDto,
  PlayerCompareQueryDto,
  PlayerProfileDto,
  PlayerSearchQueryDto,
  PlayerSearchResultDto,
  PlayerStatsQueryDto,
} from './dto/player.dto.js';
import { PlayersService } from './players.service.js';

@ApiTags('players')
@Controller('players')
export class PlayersController {
  constructor(
    @Inject(PlayersService) private readonly playersService: PlayersService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Search players by name' })
  @ApiOkResponse({ type: PlayerSearchResultDto, isArray: true })
  search(@Query() query: PlayerSearchQueryDto) {
    return this.playersService.search(query.q, query.limit ?? 20);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare 2–4 players side by side' })
  @ApiOkResponse({ type: PlayerCompareDto })
  compare(@Query() query: PlayerCompareQueryDto) {
    return this.playersService.compare(query);
  }

  @Get(':sportmonksId/batting-stats')
  @ApiOperation({ summary: 'Aggregate batting stats for a player' })
  @ApiOkResponse({ type: PlayerBattingStatsDto })
  battingStats(
    @Param('sportmonksId') sportmonksId: string,
    @Query() query: PlayerStatsQueryDto,
  ) {
    return this.playersService.getBattingStats(sportmonksId, query);
  }

  @Get(':sportmonksId/bowling-stats')
  @ApiOperation({ summary: 'Aggregate bowling stats for a player' })
  @ApiOkResponse({ type: PlayerBowlingStatsDto })
  bowlingStats(
    @Param('sportmonksId') sportmonksId: string,
    @Query() query: PlayerStatsQueryDto,
  ) {
    return this.playersService.getBowlingStats(sportmonksId, query);
  }

  @Get(':sportmonksId/career')
  @ApiOperation({ summary: 'Per-season career batting and bowling breakdown' })
  @ApiOkResponse({ type: PlayerCareerDto })
  career(
    @Param('sportmonksId') sportmonksId: string,
    @Query() query: PlayerCareerQueryDto,
  ) {
    return this.playersService.getCareer(sportmonksId, query);
  }

  @Get(':sportmonksId')
  @ApiOperation({ summary: 'Get player profile' })
  @ApiOkResponse({ type: PlayerProfileDto })
  getPlayer(@Param('sportmonksId') sportmonksId: string) {
    return this.playersService.getById(sportmonksId);
  }
}
