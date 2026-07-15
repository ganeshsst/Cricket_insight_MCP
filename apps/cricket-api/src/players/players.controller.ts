import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PlayerByNameQueryDto,
  PlayerBattingStatsDto,
  PlayerBowlingStatsDto,
  PlayerCareerDto,
  PlayerCareerQueryDto,
  PlayerCompareByNameQueryDto,
  PlayerCompareDto,
  PlayerCompareQueryDto,
  PlayerMatchLogDto,
  PlayerMatchesQueryDto,
  PlayerProfileDto,
  PlayerSearchQueryDto,
  PlayerSearchResultDto,
  PlayerStatsBundleDto,
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
    return this.playersService.search(query.q, query.limit ?? 20, query.leagueId);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare 2–4 players side by side' })
  @ApiOkResponse({ type: PlayerCompareDto })
  compare(@Query() query: PlayerCompareQueryDto) {
    return this.playersService.compare(query);
  }

  @Get('compare-by-name')
  @ApiOperation({ summary: 'Compare two players by name' })
  @ApiOkResponse({ type: PlayerCompareDto })
  compareByName(@Query() query: PlayerCompareByNameQueryDto) {
    return this.playersService.compareByName(query);
  }

  @Get('by-name/stats')
  @ApiOperation({ summary: 'Resolve a player by name and return profile, batting, and bowling stats' })
  @ApiOkResponse({ type: PlayerStatsBundleDto })
  statsByName(@Query() query: PlayerByNameQueryDto) {
    return this.playersService.getStatsByName(query);
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

  @Get(':sportmonksId/matches')
  @ApiOperation({ summary: 'Fixture-level batting and bowling log for a player' })
  @ApiOkResponse({ type: PlayerMatchLogDto })
  matches(
    @Param('sportmonksId') sportmonksId: string,
    @Query() query: PlayerMatchesQueryDto,
  ) {
    return this.playersService.getMatches(sportmonksId, query);
  }

  @Get(':sportmonksId')
  @ApiOperation({ summary: 'Get player profile' })
  @ApiOkResponse({ type: PlayerProfileDto })
  getPlayer(@Param('sportmonksId') sportmonksId: string) {
    return this.playersService.getById(sportmonksId);
  }
}
