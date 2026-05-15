/* Copyright (c) 2026. All rights reserved. */
import type { CookieOptions } from 'express';

export const buildAuthCookieOptions = (
  nodeEnv: string,
  maxAge: number,
): CookieOptions => {
  const isProduction = nodeEnv === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge,
  };
};

export const buildRefreshCookieOptions = (
  nodeEnv: string,
  maxAge: number,
): CookieOptions => {
  return {
    ...buildAuthCookieOptions(nodeEnv, maxAge),
    path: '/auth/refresh',
  };
};
