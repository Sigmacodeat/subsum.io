import './config';

import { Module } from '@nestjs/common';

import { PermissionModule } from '../permission';
import { TelemetryController } from './controller';
import { TelemetryGateway } from './gateway';
import { TelemetryService } from './service';
import { TelemetrySupportController } from './support-controller';
import { TelemetrySupportService } from './support-service';

@Module({
  imports: [PermissionModule],
  providers: [TelemetryService, TelemetryGateway, TelemetrySupportService],
  controllers: [TelemetryController, TelemetrySupportController],
})
export class TelemetryModule {}
