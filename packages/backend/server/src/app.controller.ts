import { Controller, Get } from '@nestjs/common';

import { SkipThrottle } from './base';
import { Public } from './core/auth';

@Controller('/info')
export class AppController {
  @SkipThrottle()
  @Public()
  @Get()
  info() {
    return {
      compatibility: globalThis.env.version,
      message: `Subsumio ${globalThis.env.version} Server`,
      type: globalThis.env.DEPLOYMENT_TYPE,
      flavor: globalThis.env.FLAVOR,
    };
  }
}
