import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiFixtureIdParam,
  ApiMatchListQuery,
  ApiMatchSearchQuery,
} from '../common/swagger.decorators.js';
import {
  MatchBallsDto,
  MatchBallsQueryDto,
  MatchCoverageDto,
  MatchDetailDto,
  MatchListQueryDto,
  MatchOversDto,
  MatchPartnershipsDto,
  MatchSearchQueryDto,
  MatchScorecardDto,
  MatchSummaryDto,
} from './dto/match.dto.js';
import { MatchesService } from './matches.service.js';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(
    @Inject(MatchesService) private readonly matchesService: MatchesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List matches with optional filters' })
  @ApiMatchListQuery()
  @ApiOkResponse({ type: MatchSummaryDto, isArray: true })
  list(@Query() query: MatchListQueryDto) {
    return this.matchesService.list(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search matches with semantic filters like final or team-vs-team' })
  @ApiMatchSearchQuery()
  @ApiOkResponse({ type: MatchSummaryDto, isArray: true })
  search(@Query() query: MatchSearchQueryDto) {
    return this.matchesService.search(query);
  }

  @Get('final')
  @ApiOperation({
    summary: 'Get the inferred final for a league season (newest Finished match; inferredFinal=true)',
  })
  @ApiMatchSearchQuery()
  @ApiOkResponse({ type: MatchSummaryDto })
  getFinal(@Query() query: MatchSearchQueryDto) {
    return this.matchesService.getSeasonFinal(query);
  }

  @Get(':fixtureId/scorecard')
  @ApiOperation({ summary: 'Full match scorecard with batting, bowling, lineups' })
  @ApiFixtureIdParam()
  @ApiOkResponse({ type: MatchScorecardDto })
  getScorecard(@Param('fixtureId') fixtureId: string) {
    return this.matchesService.getScorecard(fixtureId);
  }

  @Get(':fixtureId/coverage')
  @ApiOperation({ summary: 'Scorecard + ball/over row coverage for a fixture' })
  @ApiFixtureIdParam()
  @ApiOkResponse({ type: MatchCoverageDto })
  getCoverage(@Param('fixtureId') fixtureId: string) {
    return this.matchesService.getCoverage(fixtureId);
  }

  @Get(':fixtureId/overs')
  @ApiOperation({ summary: 'Over-by-over runs/wickets (Manhattan chart source)' })
  @ApiFixtureIdParam()
  @ApiOkResponse({ type: MatchOversDto })
  getOvers(@Param('fixtureId') fixtureId: string) {
    return this.matchesService.getOvers(fixtureId);
  }

  @Get(':fixtureId/partnerships')
  @ApiOperation({ summary: 'Partnerships derived from ball-by-ball striker/non-striker pairs' })
  @ApiFixtureIdParam()
  @ApiOkResponse({ type: MatchPartnershipsDto })
  getPartnerships(@Param('fixtureId') fixtureId: string) {
    return this.matchesService.getPartnerships(fixtureId);
  }

  @Get(':fixtureId/balls')
  @ApiOperation({
    summary: 'Ball-by-ball events (paginated). Includes score outcome names for event-style feeds.',
  })
  @ApiFixtureIdParam()
  @ApiOkResponse({ type: MatchBallsDto })
  getBalls(
    @Param('fixtureId') fixtureId: string,
    @Query() query: MatchBallsQueryDto,
  ) {
    return this.matchesService.getBalls(fixtureId, query);
  }

  @Get(':fixtureId')
  @ApiOperation({ summary: 'Get match summary with innings scores' })
  @ApiFixtureIdParam()
  @ApiOkResponse({ type: MatchDetailDto })
  getMatch(@Param('fixtureId') fixtureId: string) {
    return this.matchesService.getById(fixtureId);
  }
}
