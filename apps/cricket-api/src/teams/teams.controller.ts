import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiSquadQuery,
  ApiTeamHeadToHeadQuery,
  ApiTeamIdParam,
  ApiTeamSearchQuery,
  ApiTeamSeasonStatsQuery,
} from '../common/swagger.decorators.js';
import {
  SquadQueryDto,
  TeamDto,
  TeamHeadToHeadDto,
  TeamHeadToHeadQueryDto,
  TeamSearchQueryDto,
  TeamSeasonStatsDto,
  TeamSeasonStatsQueryDto,
  TeamSquadDto,
} from './dto/team.dto.js';
import { TeamsService } from './teams.service.js';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(@Inject(TeamsService) private readonly teamsService: TeamsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search teams by name or code' })
  @ApiTeamSearchQuery()
  @ApiOkResponse({ type: TeamDto, isArray: true })
  search(@Query() query: TeamSearchQueryDto) {
    return this.teamsService.search(query.q, query.limit ?? 20);
  }

  @Get('head-to-head')
  @ApiOperation({ summary: 'Head-to-head record between two teams' })
  @ApiTeamHeadToHeadQuery()
  @ApiOkResponse({ type: TeamHeadToHeadDto })
  headToHead(@Query() query: TeamHeadToHeadQueryDto) {
    return this.teamsService.getHeadToHead(query);
  }

  @Get(':teamId/season-stats')
  @ApiOperation({ summary: 'Team aggregate season stats' })
  @ApiTeamIdParam()
  @ApiTeamSeasonStatsQuery()
  @ApiOkResponse({ type: TeamSeasonStatsDto })
  seasonStats(
    @Param('teamId') teamId: string,
    @Query() query: TeamSeasonStatsQueryDto,
  ) {
    return this.teamsService.getSeasonStats(teamId, query);
  }

  @Get(':teamId/squad')
  @ApiOperation({ summary: 'Team squad for a season' })
  @ApiTeamIdParam()
  @ApiSquadQuery()
  @ApiOkResponse({ type: TeamSquadDto })
  squad(@Param('teamId') teamId: string, @Query() query: SquadQueryDto) {
    return this.teamsService.getSquad(teamId, query.seasonId);
  }

  @Get(':teamId')
  @ApiOperation({ summary: 'Get team profile' })
  @ApiTeamIdParam()
  @ApiOkResponse({ type: TeamDto })
  getTeam(@Param('teamId') teamId: string) {
    return this.teamsService.getById(teamId);
  }
}
