import {
  buildAuthCookieOptions,
  buildRefreshCookieOptions,
} from './auth-cookie.config';

describe('auth-cookie.config', () => {
  it('uses secure none cookies in production', () => {
    expect(buildAuthCookieOptions('production', 1000)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 1000,
    });
  });

  it('uses lax non-secure cookies in non-production', () => {
    expect(buildAuthCookieOptions('development', 1000)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 1000,
    });
  });

  it('sets refresh path', () => {
    expect(buildRefreshCookieOptions('production', 2000)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 2000,
      path: '/auth/refresh',
    });
  });
});
