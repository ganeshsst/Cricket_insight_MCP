import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { UsersDatabaseService } from './users-database.service.js';

@Global()
@Module({
  providers: [DatabaseService, UsersDatabaseService],
  exports: [DatabaseService, UsersDatabaseService],
})
export class DatabaseModule {}
