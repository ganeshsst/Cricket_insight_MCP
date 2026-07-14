const base = process.env.CRICKET_API_URL ?? 'http://localhost:3001';

const tests = [
  {
    name: 'P0-1 player search',
    path: '/players/search?q=Kohli&limit=3',
    expectStatus: 200,
    validate: (body) => {
      const rows = body;
      if (!Array.isArray(rows) || rows.length === 0) return 'expected non-empty array';
      if (!rows.some((r) => r.fullname.includes('Kohli'))) return 'expected Kohli in results';
      return null;
    },
  },
  {
    name: 'P0-2 player profile',
    path: '/players/46',
    expectStatus: 200,
    validate: (body) => {
      const row = body;
      if (row.sportmonksId !== '46' || row.fullname !== 'Virat Kohli') {
        return 'expected Virat Kohli profile';
      }
      return null;
    },
  },
  {
    name: 'P0-3 batting stats',
    path: '/players/46/batting-stats',
    expectStatus: 200,
    validate: (body) => {
      const row = body;
      if (row.playerId !== '46' || row.runs <= 0 || row.innings <= 0) {
        return 'expected positive batting stats';
      }
      return null;
    },
  },
  {
    name: 'P0-3 batting stats with format filter',
    path: '/players/46/batting-stats?format=T20I',
    expectStatus: 200,
    validate: (body) => {
      const row = body;
      if (row.playerId !== '46') return 'expected player 46';
      return null;
    },
  },
  {
    name: 'P0-4 bowling stats',
    path: '/players/46/bowling-stats',
    expectStatus: 200,
    validate: (body) => {
      const row = body;
      if (row.playerId !== '46') return 'expected player 46';
      return null;
    },
  },
  {
    name: 'P0-5 list matches',
    path: '/matches?limit=5',
    expectStatus: 200,
    validate: (body) => {
      const rows = body;
      if (!Array.isArray(rows) || rows.length === 0) return 'expected matches array';
      if (!rows[0].fixtureId) return 'expected fixtureId';
      return null;
    },
  },
  {
    name: 'P0-5 list matches with format filter',
    path: '/matches?format=T20I&limit=3',
    expectStatus: 200,
    validate: (body) => {
      const rows = body;
      if (!Array.isArray(rows) || rows.length === 0) return 'expected matches';
      if (rows.some((r) => r.format !== 'T20I')) return 'expected all T20I';
      return null;
    },
  },
  {
    name: 'P0-6 match detail',
    path: '/matches/67379',
    expectStatus: 200,
    validate: (body) => {
      const row = body;
      if (row.fixtureId !== '67379') return 'wrong fixture id';
      if (!row.localTeamName || !row.visitorTeamName) return 'expected team names';
      if (!Array.isArray(row.innings)) return 'expected innings array';
      return null;
    },
  },
  {
    name: 'P0 player not found',
    path: '/players/999999999',
    expectStatus: 404,
  },
  {
    name: 'P0 match not found',
    path: '/matches/999999999',
    expectStatus: 404,
  },
  {
    name: 'P1 league search',
    path: '/leagues/search?q=IPL',
    expectStatus: 200,
    validate: (body) => {
      if (!Array.isArray(body) || body.length === 0) return 'expected leagues';
      if (!body.some((r) => String(r.name).toLowerCase().includes('premier') || r.sportmonksId === '1')) {
        return 'expected IPL / Indian Premier League';
      }
      return null;
    },
  },
  {
    name: 'P1 list seasons',
    path: '/leagues/1/seasons',
    expectStatus: 200,
    validate: (body) => {
      if (!Array.isArray(body) || body.length === 0) return 'expected seasons';
      if (!body.some((r) => r.sportmonksId === '1795')) return 'expected IPL 2026 season 1795';
      return null;
    },
  },
  {
    name: 'P1 standings',
    path: '/leagues/1/seasons/1795/standings',
    expectStatus: 200,
    validate: (body) => {
      if (!Array.isArray(body.standings)) return 'expected standings array';
      if (body.standings.length < 10) return 'expected at least 10 teams';
      return null;
    },
  },
  {
    name: 'P1 batting leaderboard',
    path: '/leagues/1/seasons/1795/leaderboards/batting?format=T20&limit=5',
    expectStatus: 200,
    validate: (body) => {
      if (!Array.isArray(body.batting) || body.batting.length === 0) {
        return 'expected batting leaderboard';
      }
      if (!body.batting.some((r) => r.playerId === '3362')) {
        return 'expected Shubman Gill (3362) on batting leaderboard';
      }
      return null;
    },
  },
  {
    name: 'P1 season coverage',
    path: '/leagues/1/seasons/1795/coverage',
    expectStatus: 200,
    validate: (body) => {
      if (body.totalFixtures !== 74) return `expected totalFixtures=74 got ${body.totalFixtures}`;
      if (typeof body.fixturesWithBatting !== 'number') return 'expected fixturesWithBatting';
      return null;
    },
  },
  {
    name: 'P1 team search',
    path: '/teams/search?q=Mumbai',
    expectStatus: 200,
    validate: (body) => {
      if (!Array.isArray(body) || body.length === 0) return 'expected teams';
      if (!body.some((r) => r.sportmonksId === '6' && r.name.includes('Mumbai'))) {
        return 'expected Mumbai Indians sportmonksId=6';
      }
      return null;
    },
  },
  {
    name: 'P1 match scorecard',
    path: '/matches/69668/scorecard',
    expectStatus: 200,
    validate: (body) => {
      if (!body.fixture || body.fixture.fixtureId !== '69668') return 'expected fixture 69668';
      if (!Array.isArray(body.innings) || body.innings.length === 0) return 'expected innings';
      const batters = body.innings.flatMap((i) => i.batting ?? []);
      const kohli = batters.find((b) => b.playerId === '46');
      if (!kohli) return 'expected Kohli in scorecard batting';
      if (kohli.runs !== 75 || kohli.balls !== 42) {
        return `expected Kohli 75 (42) got ${kohli.runs} (${kohli.balls})`;
      }
      return null;
    },
  },
  {
    name: 'P1 player career',
    path: '/players/46/career?leagueId=1&format=T20',
    expectStatus: 200,
    validate: (body) => {
      if (body.playerId !== '46') return 'expected player 46';
      if (!Array.isArray(body.seasons) || body.seasons.length === 0) {
        return 'expected at least one season row';
      }
      return null;
    },
  },
  {
    name: 'P1 compare players',
    path: '/players/compare?ids=46,3362&leagueId=1&seasonId=1795&format=T20',
    expectStatus: 200,
    validate: (body) => {
      if (!Array.isArray(body.players) || body.players.length !== 2) {
        return 'expected 2 compared players';
      }
      return null;
    },
  },
  {
    name: 'Swagger docs',
    path: '/docs',
    expectStatus: 200,
  },
];

let passed = 0;
let failed = 0;

console.log(`Testing Cricket API at ${base}\n`);

for (const test of tests) {
  try {
    const response = await fetch(`${base}${test.path}`);
    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (response.status !== test.expectStatus) {
      failed++;
      console.log(`FAIL  ${test.name}`);
      console.log(`      expected ${test.expectStatus}, got ${response.status}`);
      console.log(`      ${JSON.stringify(body).slice(0, 200)}`);
      continue;
    }

    const validationError = test.validate?.(body) ?? null;
    if (validationError) {
      failed++;
      console.log(`FAIL  ${test.name}`);
      console.log(`      ${validationError}`);
      continue;
    }

    passed++;
    console.log(`PASS  ${test.name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL  ${test.name}`);
    console.log(`      ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
