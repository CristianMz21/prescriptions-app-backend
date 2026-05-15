/* Copyright (c) 2026. All rights reserved. */
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const LOCAL_ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
] as const;

const HTTP_PROTOCOL_PATTERN = /^https?:\/\//i;

export interface PreviewOriginRule {
  prefix: string;
  requiredSegment: string;
  suffix: string;
}

export const normalizeConfiguredOrigin = (
  envVarName: string,
  origin: string | undefined,
): string | undefined => {
  if (!origin) {
    return undefined;
  }

  if (!HTTP_PROTOCOL_PATTERN.test(origin)) {
    throw new Error(
      `Environment validation failed: ${envVarName} must start with http:// or https://`,
    );
  }

  return new URL(origin).origin;
};

export const parseConfiguredOrigins = (
  envVarName: string,
  originList: string | undefined,
): string[] => {
  if (!originList) {
    return [];
  }

  return originList
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0)
    .map(origin => normalizeConfiguredOrigin(envVarName, origin))
    .filter((origin): origin is string => typeof origin === 'string');
};

export const isAllowedVercelPreviewOrigin = (
  origin: string,
  rule: PreviewOriginRule | undefined,
): boolean => {
  if (!rule) {
    return false;
  }

  return (
    origin.startsWith(rule.prefix) &&
    origin.includes(rule.requiredSegment) &&
    origin.endsWith(rule.suffix)
  );
};

export const buildAllowedOrigins = (config: {
  appOrigin?: string;
  frontendUrl?: string;
  additionalOrigins?: string;
}): ReadonlySet<string> => {
  const appOrigin = normalizeConfiguredOrigin('APP_ORIGIN', config.appOrigin);
  const frontendUrl = normalizeConfiguredOrigin(
    'FRONTEND_URL',
    config.frontendUrl,
  );
  const additionalOrigins = parseConfiguredOrigins(
    'CORS_ADDITIONAL_ORIGINS',
    config.additionalOrigins,
  );

  const allowedOrigins = new Set<string>([...LOCAL_ALLOWED_ORIGINS]);

  if (appOrigin) {
    allowedOrigins.add(appOrigin);
  }

  if (frontendUrl) {
    allowedOrigins.add(frontendUrl);
  }

  for (const origin of additionalOrigins) {
    allowedOrigins.add(origin);
  }

  return allowedOrigins;
};

export const isAllowedOrigin = (
  origin: string,
  allowedOrigins: ReadonlySet<string>,
  previewRule: PreviewOriginRule | undefined,
): boolean => {
  return (
    allowedOrigins.has(origin) ||
    isAllowedVercelPreviewOrigin(origin, previewRule)
  );
};

export const buildCorsOptions = (config: {
  appOrigin?: string;
  frontendUrl?: string;
  additionalOrigins?: string;
  previewRule?: PreviewOriginRule;
}): CorsOptions => {
  const allowedOrigins = buildAllowedOrigins(config);

  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isAllowedOrigin(origin, allowedOrigins, config.previewRule)) {
        callback(null, origin);
        return;
      }

      callback(new Error(`Not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    optionsSuccessStatus: 204,
  };
};
