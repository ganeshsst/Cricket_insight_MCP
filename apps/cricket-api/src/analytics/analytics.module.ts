import { Module } from '@nestjs/common';
import { LeaguesModule } from '../leagues/leagues.module.js';
import { PlayersModule } from '../players/players.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [LeaguesModule, PlayersModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
