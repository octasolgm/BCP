import { Module } from '@nestjs/common';
import { ComplianceItemsController } from './compliance-items.controller';
import { ComplianceItemsService } from './compliance-items.service';

@Module({
  controllers: [ComplianceItemsController],
  providers: [ComplianceItemsService],
  exports: [ComplianceItemsService],
})
export class ComplianceItemsModule {}
