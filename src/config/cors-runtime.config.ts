/* Copyright (c) 2026. All rights reserved. */
import type { ConfigService } from '@nestjs/config';
import type { PreviewOriginRule } from './cors.config';

export interface CorsRuntimeConfig {
  appOrigin: string | undefined;
  frontendUrl: string | undefined;
  additionalOrigins: string | undefined;
  previewRule: PreviewOriginRule | undefined;
}

export const getCorsRuntimeConfig = (
  configService: ConfigService,
): CorsRuntimeConfig => {
  const appOrigin = configService.get<string>('APP_ORIGIN');
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const additionalOrigins = configService.get<string>(
    'CORS_ADDITIONAL_ORIGINS',
  );
  const previewPrefix = configService.get<string>('CORS_PREVIEW_PREFIX');
  const previewRequiredSegment = configService.get<string>(
    'CORS_PREVIEW_REQUIRED_SEGMENT',
  );
  const previewSuffix = configService.get<string>('CORS_PREVIEW_SUFFIX');

  const previewRule =
    previewPrefix && previewRequiredSegment && previewSuffix
      ? {
          prefix: previewPrefix,
          requiredSegment: previewRequiredSegment,
          suffix: previewSuffix,
        }
      : undefined;

  return {
    appOrigin,
    frontendUrl,
    additionalOrigins,
    previewRule,
  };
};
