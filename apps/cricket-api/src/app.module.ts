import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { ChatHistoryModule } from './chat-history/chat-history.module.js';
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
    AnalyticsModule,
    ChatHistoryModule,
  ],
})
export class AppModule {}
