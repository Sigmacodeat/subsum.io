import { Module } from '@nestjs/common';

import { PermissionModule } from '../../core/permission';
import { LegalAuditService } from './legal-audit.service';
import { LegalCaseController } from './legal-case.controller';
import { LegalCaseService } from './legal-case.service';
import { LegalConflictService } from './legal-conflict.service';
import { LegalDeadlineCalculator } from './legal-deadline-calculator';

@Module({
  imports: [PermissionModule],
  providers: [
    LegalCaseService,
    LegalAuditService,
    LegalConflictService,
    LegalDeadlineCalculator,
  ],
  controllers: [LegalCaseController],
  exports: [LegalCaseService, LegalAuditService, LegalDeadlineCalculator],
})
export class LegalCaseModule {}
