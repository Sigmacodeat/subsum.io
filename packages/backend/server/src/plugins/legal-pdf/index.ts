import { Module } from '@nestjs/common';

import { DocStorageModule } from '../../core/doc';
import { PermissionModule } from '../../core/permission';
import { StorageModule } from '../../core/storage';
import { PaymentModule } from '../payment';

import { LegalPdfController } from './legal-pdf.controller';
import { LegalPdfRenderService } from './legal-pdf.service';
import { LawFirmProfileController } from './law-firm-profile.controller';
import { LawFirmProfileService } from './law-firm-profile.service';
import { DocuSignController } from './docusign.controller';
import { DocuSignService } from './docusign.service';

@Module({
  imports: [PaymentModule, DocStorageModule, StorageModule, PermissionModule],
  providers: [LegalPdfRenderService, LawFirmProfileService, DocuSignService],
  controllers: [LegalPdfController, LawFirmProfileController, DocuSignController],
})
export class LegalPdfModule {}
