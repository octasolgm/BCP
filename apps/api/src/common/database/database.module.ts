import { Global, Module } from '@nestjs/common';
import { DatabaseMigrationService } from './database-migration.service';

@Global()
@Module({
  providers: [DatabaseMigrationService],
  exports: [DatabaseMigrationService],
})
export class DatabaseModule {}
