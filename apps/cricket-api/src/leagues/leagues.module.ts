import { Module } from '@nestjs/common';
import { LeaguesController } from './leagues.controller.js';
import { LeaguesService } from './leagues.service.js';

@Module({
  controllers: [LeaguesController],
  providers: [LeaguesService],
  exports: [LeaguesService],
})
export class LeaguesModule {}
