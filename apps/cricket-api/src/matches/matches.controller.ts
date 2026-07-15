import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MatchCoverageDto,
  MatchDetailDto,
  MatchListQueryDto,
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
  @ApiOkResponse({ type: MatchSummaryDto, isArray: true })
  list(@Query() query: MatchListQueryDto) {
    return this.matchesService.list(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search matches with semantic filters like final or team-vs-team' })
  @ApiOkResponse({ type: MatchSummaryDto, isArray: true })
  search(@Query() query: MatchSearchQueryDto) {
    return this.matchesService.search(query);
  }

  @Get('final')
  @ApiOperation({ summary: 'Get the inferred final for a league season' })
  @ApiOkResponse({ type: MatchSummaryDto })
  getFinal(@Query() query: MatchSearchQueryDto) {
    return this.matchesService.getSeasonFinal(query);
  }

  @Get(':fixtureId/scorecard')
  @ApiOperation({ summary: 'Full match scorecard with batting, bowling, lineups' })
  @ApiOkResponse({ type: MatchScorecardDto })
  getScorecard(@Param('fixtureId') fixtureId: string) {
    return this.matchesService.getScorecard(fixtureId);
  }

  @Get(':fixtureId/coverage')
  @ApiOperation({ summary: 'Scorecard row coverage for a fixture' })
  @ApiOkResponse({ type: MatchCoverageDto })
  getCoverage(@Param('fixtureId') fixtureId: string) {
    return this.matchesService.getCoverage(fixtureId);
  }

  @Get(':fixtureId')
  @ApiOperation({ summary: 'Get match summary with innings scores' })
  @ApiOkResponse({ type: MatchDetailDto })
  getMatch(@Param('fixtureId') fixtureId: string) {
    return this.matchesService.getById(fixtureId);
  }
}
