import { applyDecorators } from '@nestjs/common';
import { ApiParam, ApiQuery } from '@nestjs/swagger';

/** Path params */

export const ApiSportmonksIdParam = () =>
  ApiParam({
    name: 'sportmonksId',
    description: 'Player SportMonks id',
    example: '46',
  });

export const ApiFixtureIdParam = () =>
  ApiParam({
    name: 'fixtureId',
    description: 'Fixture SportMonks id',
    example: '69668',
  });

export const ApiLeagueIdParam = () =>
  ApiParam({
    name: 'leagueId',
    description: 'League SportMonks id — IPL = 1',
    example: '1',
  });

export const ApiSeasonIdParam = () =>
  ApiParam({
    name: 'seasonId',
    description: 'Season SportMonks id — IPL 2026 = 1795',
    example: '1795',
  });

export const ApiTeamIdParam = () =>
  ApiParam({
    name: 'teamId',
    description: 'Team SportMonks id',
    example: '6',
  });

export const ApiVenueIdParam = () =>
  ApiParam({
    name: 'venueId',
    description: 'Venue SportMonks id',
    example: '59',
  });

/** Shared query params */

export const ApiPlayerFormatLeagueQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'format',
      required: false,
      type: String,
      description: 'Match format e.g. T20 (IPL), T20I, ODI, Test',
      example: 'T20',
    }),
    ApiQuery({
      name: 'leagueId',
      required: false,
      type: Number,
      description: 'League SportMonks id — IPL = 1',
      example: 1,
    }),
  );

export const ApiPlayerStatsQuery = () =>
  applyDecorators(
    ApiPlayerFormatLeagueQuery(),
    ApiQuery({
      name: 'seasonId',
      required: false,
      type: Number,
      description: 'Season SportMonks id — IPL 2026 = 1795',
      example: 1795,
    }),
  );

export const ApiPlayerSearchQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'q',
      required: true,
      type: String,
      description: 'Player name search text',
      example: 'Kohli',
    }),
    ApiQuery({
      name: 'leagueId',
      required: false,
      type: Number,
      description: 'Only include players associated with this league',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Max results',
      example: 20,
    }),
  );

export const ApiPlayerByNameQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'q',
      required: true,
      type: String,
      description: 'Player name to resolve',
      example: 'Virat Kohli',
    }),
    ApiPlayerStatsQuery(),
  );

export const ApiPlayerCompareByNameQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'a',
      required: true,
      type: String,
      description: 'First player name',
      example: 'Virat Kohli',
    }),
    ApiQuery({
      name: 'b',
      required: true,
      type: String,
      description: 'Second player name',
      example: 'MS Dhoni',
    }),
    ApiPlayerStatsQuery(),
  );

export const ApiPlayerCompareQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'ids',
      required: true,
      type: String,
      description: 'Comma-separated SportMonks player ids (2–4)',
      example: '46,3362',
    }),
    ApiPlayerStatsQuery(),
  );

export const ApiPlayerMatchesQuery = () =>
  applyDecorators(
    ApiPlayerStatsQuery(),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Max matches to return',
      example: 20,
    }),
  );

export const ApiMatchListQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'leagueId',
      required: false,
      type: Number,
      description: 'League SportMonks id',
      example: 1,
    }),
    ApiQuery({
      name: 'seasonId',
      required: false,
      type: Number,
      description: 'Season SportMonks id',
      example: 1795,
    }),
    ApiQuery({
      name: 'teamId',
      required: false,
      type: Number,
      description: 'Filter matches involving this team',
      example: 8,
    }),
    ApiQuery({
      name: 'format',
      required: false,
      type: String,
      description: 'Match format e.g. T20, T20I',
      example: 'T20',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Max results (1–100)',
      example: 20,
    }),
    ApiQuery({
      name: 'offset',
      required: false,
      type: Number,
      description: 'Pagination offset',
      example: 0,
    }),
  );

export const ApiMatchSearchQuery = () =>
  applyDecorators(
    ApiMatchListQuery(),
    ApiQuery({
      name: 'type',
      required: false,
      type: String,
      description: 'Semantic match type, e.g. final',
      example: 'final',
    }),
    ApiQuery({
      name: 'teamAId',
      required: false,
      type: Number,
      description: 'First team SportMonks id',
      example: 6,
    }),
    ApiQuery({
      name: 'teamBId',
      required: false,
      type: Number,
      description: 'Second team SportMonks id',
      example: 2,
    }),
  );

export const ApiLeagueSearchQuery = () =>
  ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'League name search text',
    example: 'IPL',
  });

export const ApiLeagueResolveQuery = () =>
  ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Natural language league/season query',
    example: 'IPL 2026',
  });

export const ApiLeaderboardQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'format',
      required: false,
      type: String,
      description: 'Match format — IPL uses T20',
      example: 'T20',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Max rows (1–50)',
      example: 20,
    }),
  );

export const ApiTeamSearchQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'q',
      required: true,
      type: String,
      description: 'Team name or code search text',
      example: 'Mumbai',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Max results',
      example: 20,
    }),
  );

export const ApiTeamHeadToHeadQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'teamAId',
      required: true,
      type: Number,
      description: 'First team SportMonks id',
      example: 6,
    }),
    ApiQuery({
      name: 'teamBId',
      required: true,
      type: Number,
      description: 'Second team SportMonks id',
      example: 2,
    }),
    ApiQuery({
      name: 'leagueId',
      required: false,
      type: Number,
      description: 'Optional league SportMonks id',
      example: 1,
    }),
  );

export const ApiTeamSeasonStatsQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'seasonId',
      required: true,
      type: Number,
      description: 'Season SportMonks id — IPL 2026 = 1795',
      example: 1795,
    }),
    ApiQuery({
      name: 'leagueId',
      required: false,
      type: Number,
      description: 'League SportMonks id',
      example: 1,
    }),
  );

export const ApiSquadQuery = () =>
  ApiQuery({
    name: 'seasonId',
    required: true,
    type: Number,
    description: 'Season SportMonks id — IPL 2026 = 1795',
    example: 1795,
  });
