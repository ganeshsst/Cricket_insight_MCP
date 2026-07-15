import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { LeaguesModule } from './leagues/leagues.module.js';
import { MatchesModule } from './matches/matches.module.js';
import { PlayersModule } from './players/players.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { VenuesModule } from './venues/venues.module.js';

@Module({
  imports: [
    DatabaseModule,
    LeaguesModule,
    PlayersModule,
    MatchesModule,
    TeamsModule,
    VenuesModule,
  ],
})
export class AppModule {}
