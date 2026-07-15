import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  LeagueDto,
  LeagueResolveQueryDto,
  LeagueSearchQueryDto,
  LeaderboardQueryDto,
  ResolvedSeasonDto,
  SeasonAwardsDto,
  SeasonCoverageDto,
  SeasonDto,
  SeasonLeaderboardDto,
  SeasonPlayoffsDto,
  SeasonStandingsDto,
} from './dto/league.dto.js';
import { LeaguesService } from './leagues.service.js';

@ApiTags('leagues')
@Controller('leagues')
export class LeaguesController {
  constructor(@Inject(LeaguesService) private readonly leaguesService: LeaguesService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search leagues e.g. IPL' })
  @ApiOkResponse({ type: LeagueDto, isArray: true })
  search(@Query() query: LeagueSearchQueryDto) {
    return this.leaguesService.search(query.q);
  }

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve a natural language league/season query e.g. IPL 2024' })
  @ApiOkResponse({ type: ResolvedSeasonDto })
  resolve(@Query() query: LeagueResolveQueryDto) {
    return this.leaguesService.resolveSeasonQuery(query.q);
  }

  @Get(':leagueId/seasons')
  @ApiOperation({ summary: 'List seasons for a league' })
  @ApiOkResponse({ type: SeasonDto, isArray: true })
  seasons(@Param('leagueId') leagueId: string) {
    return this.leaguesService.listSeasons(leagueId);
  }

  @Get(':leagueId/seasons/:seasonId/standings')
  @ApiOperation({ summary: 'Season points table / standings' })
  @ApiOkResponse({ type: SeasonStandingsDto })
  standings(
    @Param('leagueId') leagueId: string,
    @Param('seasonId') seasonId: string,
  ) {
    return this.leaguesService.getStandings(leagueId, seasonId);
  }

  @Get(':leagueId/seasons/:seasonId/leaderboards/batting')
  @ApiOperation({ summary: 'Top batters for a league season' })
  @ApiOkResponse({ type: SeasonLeaderboardDto })
  battingLeaderboard(
    @Param('leagueId') leagueId: string,
    @Param('seasonId') seasonId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    return this.leaguesService.getBattingLeaderboard(
      leagueId,
      seasonId,
      query.format,
      query.limit ?? 20,
    );
  }

  @Get(':leagueId/seasons/:seasonId/leaderboards/bowling')
  @ApiOperation({ summary: 'Top bowlers for a league season' })
  @ApiOkResponse({ type: SeasonLeaderboardDto })
  bowlingLeaderboard(
    @Param('leagueId') leagueId: string,
    @Param('seasonId') seasonId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    return this.leaguesService.getBowlingLeaderboard(
      leagueId,
      seasonId,
      query.format,
      query.limit ?? 20,
    );
  }

  @Get(':leagueId/seasons/:seasonId/awards')
  @ApiOperation({ summary: 'Orange Cap and Purple Cap winners for a season' })
  @ApiOkResponse({ type: SeasonAwardsDto })
  awards(
    @Param('leagueId') leagueId: string,
    @Param('seasonId') seasonId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    return this.leaguesService.getSeasonAwards(
      leagueId,
      seasonId,
      query.format ?? 'T20',
    );
  }

  @Get(':leagueId/seasons/:seasonId/playoffs')
  @ApiOperation({ summary: 'Inferred playoff matches for a league season' })
  @ApiOkResponse({ type: SeasonPlayoffsDto })
  playoffs(
    @Param('leagueId') leagueId: string,
    @Param('seasonId') seasonId: string,
  ) {
    return this.leaguesService.getSeasonPlayoffs(leagueId, seasonId);
  }

  @Get(':leagueId/seasons/:seasonId/coverage')
  @ApiOperation({ summary: 'Scorecard ingest coverage for a season' })
  @ApiOkResponse({ type: SeasonCoverageDto })
  coverage(
    @Param('leagueId') leagueId: string,
    @Param('seasonId') seasonId: string,
  ) {
    return this.leaguesService.getSeasonCoverage(leagueId, seasonId);
  }
}
