/* Copyright (c) 2026. All rights reserved. */
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Service heartbeat',
    description:
      'Returns a static greeting string; useful for liveness probes and smoke checks.',
  })
  @ApiOkResponse({
    schema: { type: 'string', example: 'Hello World!' },
    description: 'Service is reachable.',
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
