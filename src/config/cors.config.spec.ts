import {
  buildAllowedOrigins,
  buildCorsOptions,
  isAllowedOrigin,
  isAllowedVercelPreviewOrigin,
  normalizeConfiguredOrigin,
  parseConfiguredOrigins,
  type PreviewOriginRule,
} from './cors.config';

const previewRule: PreviewOriginRule = {
  prefix: 'https://prescriptions-',
  requiredSegment: 'cristians-projects-04637ff3',
  suffix: '.vercel.app',
};

describe('cors.config', () => {
  describe('normalizeConfiguredOrigin', () => {
    it('returns undefined when configured origin is missing', () => {
      expect(
        normalizeConfiguredOrigin('APP_ORIGIN', undefined),
      ).toBeUndefined();
    });

    it('normalizes valid origin values', () => {
      expect(
        normalizeConfiguredOrigin(
          'APP_ORIGIN',
          'https://prescriptions-app-eight.vercel.app/path?a=1',
        ),
      ).toBe('https://prescriptions-app-eight.vercel.app');
    });

    it('throws when origin does not include protocol', () => {
      expect(() =>
        normalizeConfiguredOrigin(
          'FRONTEND_URL',
          'prescriptions-app.vercel.app',
        ),
      ).toThrow(
        'Environment validation failed: FRONTEND_URL must start with http:// or https://',
      );
    });
  });

  describe('parseConfiguredOrigins', () => {
    it('parses and normalizes comma-separated origins', () => {
      expect(
        parseConfiguredOrigins(
          'CORS_ADDITIONAL_ORIGINS',
          'https://a.example.com, http://127.0.0.1:3001/path',
        ),
      ).toEqual(['https://a.example.com', 'http://127.0.0.1:3001']);
    });
  });

  describe('preview origin validation', () => {
    it('rejects preview origin when no preview rule configured', () => {
      expect(
        isAllowedVercelPreviewOrigin(
          'https://prescriptions-abc-cristians-projects-04637ff3.vercel.app',
          undefined,
        ),
      ).toBe(false);
    });

    it('accepts matching vercel preview origin', () => {
      expect(
        isAllowedVercelPreviewOrigin(
          'https://prescriptions-abc-cristians-projects-04637ff3.vercel.app',
          previewRule,
        ),
      ).toBe(true);
    });

    it('rejects malicious lookalike preview domain', () => {
      expect(
        isAllowedVercelPreviewOrigin(
          'https://prescriptions-abc-cristians-projects-04637ff3.vercel.app.evil.com',
          previewRule,
        ),
      ).toBe(false);
    });
  });

  describe('allowed origins', () => {
    const allowedOrigins = buildAllowedOrigins({
      appOrigin: 'https://prescriptions-app-eight.vercel.app',
      frontendUrl: 'https://prescriptions-app-eight.vercel.app',
      additionalOrigins: 'https://extra.example.com',
    });

    it('includes required local origins', () => {
      expect(allowedOrigins.has('http://localhost:3001')).toBe(true);
      expect(allowedOrigins.has('http://127.0.0.1:3001')).toBe(true);
    });

    it('allows strict preview origin and rejects invalid vercel origin', () => {
      expect(
        isAllowedOrigin(
          'https://prescriptions-pr-123-cristians-projects-04637ff3.vercel.app',
          allowedOrigins,
          previewRule,
        ),
      ).toBe(true);
      expect(
        isAllowedOrigin(
          'https://prescriptions-pr-123.vercel.app',
          allowedOrigins,
          previewRule,
        ),
      ).toBe(false);
      expect(
        isAllowedOrigin(
          'https://prescriptions-pr-123-cristians-projects-04637ff3.vercel.app',
          allowedOrigins,
          undefined,
        ),
      ).toBe(false);
    });
  });

  describe('cors callback', () => {
    it('allows requests without origin header', done => {
      const options = buildCorsOptions({
        appOrigin: 'https://prescriptions-app-eight.vercel.app',
        frontendUrl: 'https://prescriptions-app-eight.vercel.app',
        previewRule,
      });
      const originHandler = options.origin;

      if (typeof originHandler !== 'function') {
        throw new Error('Expected function origin handler');
      }

      originHandler(undefined, (error, value) => {
        expect(error).toBeNull();
        expect(value).toBe(true);
        done();
      });
    });

    it('echoes allowed request origin', done => {
      const options = buildCorsOptions({
        appOrigin: 'https://prescriptions-app-eight.vercel.app',
        frontendUrl: 'https://prescriptions-app-eight.vercel.app',
        previewRule,
      });
      const originHandler = options.origin;

      if (typeof originHandler !== 'function') {
        throw new Error('Expected function origin handler');
      }

      originHandler('http://localhost:3001', (error, value) => {
        expect(error).toBeNull();
        expect(value).toBe('http://localhost:3001');
        done();
      });
    });

    it('rejects non-allowed origin', done => {
      const options = buildCorsOptions({
        appOrigin: 'https://prescriptions-app-eight.vercel.app',
        frontendUrl: 'https://prescriptions-app-eight.vercel.app',
        previewRule,
      });
      const originHandler = options.origin;

      if (typeof originHandler !== 'function') {
        throw new Error('Expected function origin handler');
      }

      originHandler('https://attacker.example', (error, value) => {
        expect(error).toBeInstanceOf(Error);
        expect(value).toBe(false);
        done();
      });
    });
  });
});
