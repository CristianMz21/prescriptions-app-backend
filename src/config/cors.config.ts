/* Copyright (c) 2026. All rights reserved. */
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const LOCAL_ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
] as const;

const PRODUCTION_ALLOWED_ORIGIN = 'https://prescriptions-app-eight.vercel.app';

const PREVIEW_PREFIX = 'https://prescriptions-';
const PREVIEW_REQUIRED_SEGMENT = 'cristians-projects-04637ff3';
const PREVIEW_SUFFIX = '.vercel.app';

const HTTP_PROTOCOL_PATTERN = /^https?:\/\//i;

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

  const normalized = new URL(origin).origin;
  return normalized;
};

export const isAllowedVercelPreviewOrigin = (origin: string): boolean => {
  return (
    origin.startsWith(PREVIEW_PREFIX) &&
    origin.includes(PREVIEW_REQUIRED_SEGMENT) &&
    origin.endsWith(PREVIEW_SUFFIX)
  );
};

export const buildAllowedOrigins = (config: {
  appOrigin?: string;
  frontendUrl?: string;
}): ReadonlySet<string> => {
  const appOrigin = normalizeConfiguredOrigin('APP_ORIGIN', config.appOrigin);
  const frontendUrl = normalizeConfiguredOrigin(
    'FRONTEND_URL',
    config.frontendUrl,
  );

  const allowedOrigins = new Set<string>([
    ...LOCAL_ALLOWED_ORIGINS,
    PRODUCTION_ALLOWED_ORIGIN,
  ]);

  if (appOrigin) {
    allowedOrigins.add(appOrigin);
  }

  if (frontendUrl) {
    allowedOrigins.add(frontendUrl);
  }

  return allowedOrigins;
};

export const isAllowedOrigin = (
  origin: string,
  allowedOrigins: ReadonlySet<string>,
): boolean => {
  return allowedOrigins.has(origin) || isAllowedVercelPreviewOrigin(origin);
};

export const buildCorsOptions = (config: {
  appOrigin?: string;
  frontendUrl?: string;
}): CorsOptions => {
  const allowedOrigins = buildAllowedOrigins(config);

  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isAllowedOrigin(origin, allowedOrigins)) {
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
