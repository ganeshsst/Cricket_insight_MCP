import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiPlayerByNameQuery,
  ApiPlayerCompareByNameQuery,
  ApiPlayerCompareQuery,
  ApiPlayerFormatLeagueQuery,
  ApiPlayerMatchesQuery,
  ApiPlayerMatchupByNameQuery,
  ApiPlayerMatchupQuery,
  ApiPlayerSearchQuery,
  ApiPlayerStatsQuery,
  ApiSportmonksIdParam,
} from '../common/swagger.decorators.js';
import {
  PlayerByNameQueryDto,
  PlayerBattingStatsDto,
  PlayerBowlingStatsDto,
  PlayerCareerDto,
  PlayerCareerQueryDto,
  PlayerCompareByNameQueryDto,
  PlayerCompareDto,
  PlayerCompareQueryDto,
  PlayerDismissalAnalysisDto,
  PlayerDismissalByNameQueryDto,
  PlayerMatchLogDto,
  PlayerMatchesQueryDto,
  PlayerMatchupByNameQueryDto,
  PlayerMatchupDto,
  PlayerMatchupQueryDto,
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
  @ApiPlayerSearchQuery()
  @ApiOkResponse({ type: PlayerSearchResultDto, isArray: true })
  search(@Query() query: PlayerSearchQueryDto) {
    return this.playersService.search(query.q, query.limit ?? 20, query.leagueId);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare 2–4 players side by side' })
  @ApiPlayerCompareQuery()
  @ApiOkResponse({ type: PlayerCompareDto })
  compare(@Query() query: PlayerCompareQueryDto) {
    return this.playersService.compare(query);
  }

  @Get('compare-by-name')
  @ApiOperation({ summary: 'Compare two players by name' })
  @ApiPlayerCompareByNameQuery()
  @ApiOkResponse({ type: PlayerCompareDto })
  compareByName(@Query() query: PlayerCompareByNameQueryDto) {
    return this.playersService.compareByName(query);
  }

  @Get('matchup')
  @ApiOperation({
    summary: 'Batter vs bowler head-to-head (dismissals + ball stats when available)',
  })
  @ApiPlayerMatchupQuery()
  @ApiOkResponse({ type: PlayerMatchupDto })
  matchup(@Query() query: PlayerMatchupQueryDto) {
    return this.playersService.getMatchup(query);
  }

  @Get('matchup-by-name')
  @ApiOperation({
    summary:
      'Batter vs bowler H2H by name. Pass batter+bowler, or a+b to infer roles.',
  })
  @ApiPlayerMatchupByNameQuery()
  @ApiOkResponse({ type: PlayerMatchupDto })
  matchupByName(@Query() query: PlayerMatchupByNameQueryDto) {
    return this.playersService.getMatchupByName(query);
  }

  @Get('by-name/stats')
  @ApiOperation({ summary: 'Resolve a player by name and return profile, batting, and bowling stats' })
  @ApiPlayerByNameQuery()
  @ApiOkResponse({ type: PlayerStatsBundleDto })
  statsByName(@Query() query: PlayerByNameQueryDto) {
    return this.playersService.getStatsByName(query);
  }

  @Get('by-name/dismissals')
  @ApiOperation({
    summary: 'Resolve a player by name and return a data-grounded dismissal (batting weakness) profile',
  })
  @ApiPlayerByNameQuery()
  @ApiOkResponse({ type: PlayerDismissalAnalysisDto })
  dismissalsByName(@Query() query: PlayerDismissalByNameQueryDto) {
    return this.playersService.getDismissalsByName(query);
  }

  @Get(':sportmonksId/batting-stats')
  @ApiOperation({ summary: 'Aggregate batting stats for a player' })
  @ApiSportmonksIdParam()
  @ApiPlayerStatsQuery()
  @ApiOkResponse({ type: PlayerBattingStatsDto })
  battingStats(
    @Param('sportmonksId') sportmonksId: string,
    @Query() query: PlayerStatsQueryDto,
  ) {
    return this.playersService.getBattingStats(sportmonksId, query);
  }

  @Get(':sportmonksId/bowling-stats')
  @ApiOperation({ summary: 'Aggregate bowling stats for a player' })
  @ApiSportmonksIdParam()
  @ApiPlayerStatsQuery()
  @ApiOkResponse({ type: PlayerBowlingStatsDto })
  bowlingStats(
    @Param('sportmonksId') sportmonksId: string,
    @Query() query: PlayerStatsQueryDto,
  ) {
    return this.playersService.getBowlingStats(sportmonksId, query);
  }

  @Get(':sportmonksId/career')
  @ApiOperation({ summary: 'Per-season career batting and bowling breakdown' })
  @ApiSportmonksIdParam()
  @ApiPlayerFormatLeagueQuery()
  @ApiOkResponse({ type: PlayerCareerDto })
  career(
    @Param('sportmonksId') sportmonksId: string,
    @Query() query: PlayerCareerQueryDto,
  ) {
    return this.playersService.getCareer(sportmonksId, query);
  }

  @Get(':sportmonksId/matches')
  @ApiOperation({ summary: 'Fixture-level batting and bowling log for a player' })
  @ApiSportmonksIdParam()
  @ApiPlayerMatchesQuery()
  @ApiOkResponse({ type: PlayerMatchLogDto })
  matches(
    @Param('sportmonksId') sportmonksId: string,
    @Query() query: PlayerMatchesQueryDto,
  ) {
    return this.playersService.getMatches(sportmonksId, query);
  }

  @Get(':sportmonksId/dismissals')
  @ApiOperation({
    summary: 'Dismissal breakdown (how a batter gets out: type, pace vs spin, phase)',
  })
  @ApiSportmonksIdParam()
  @ApiPlayerStatsQuery()
  @ApiOkResponse({ type: PlayerDismissalAnalysisDto })
  dismissals(
    @Param('sportmonksId') sportmonksId: string,
    @Query() query: PlayerStatsQueryDto,
  ) {
    return this.playersService.getDismissals(sportmonksId, query);
  }

  @Get(':sportmonksId')
  @ApiOperation({ summary: 'Get player profile' })
  @ApiSportmonksIdParam()
  @ApiOkResponse({ type: PlayerProfileDto })
  getPlayer(@Param('sportmonksId') sportmonksId: string) {
    return this.playersService.getById(sportmonksId);
  }
}
