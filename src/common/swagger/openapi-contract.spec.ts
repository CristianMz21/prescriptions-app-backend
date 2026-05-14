/* Copyright (c) 2026. All rights reserved. */
import { readFileSync } from 'fs';
import { join } from 'path';

interface OpenApiOperation {
  operationId?: string;
  requestBody?: unknown;
  responses?: Record<
    string,
    { content?: Record<string, { schema?: unknown }> }
  >;
}

interface OpenApiSpec {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<
      string,
      {
        properties?: Record<string, unknown>;
        enum?: unknown[];
        type?: string;
      }
    >;
  };
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const ERROR_CODE_RE = /^[45]\d\d$/;

// Endpoints that legitimately accept no request body (cookie-only POST).
const POST_WITHOUT_BODY_ALLOWLIST = new Set(['/auth/refresh', '/auth/logout']);

const SPEC_PATH = join(process.cwd(), 'openapi.json');
const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8')) as OpenApiSpec;

const operations: Array<{
  path: string;
  method: string;
  op: OpenApiOperation;
}> = Object.entries(spec.paths).flatMap(([path, methods]) =>
  HTTP_METHODS.filter(m => methods[m]).map(method => ({
    path,
    method,
    op: methods[method],
  })),
);

const errorResponseRef = '#/components/schemas/ErrorResponseDto';

const refOf = (schema: unknown): string | undefined => {
  if (typeof schema !== 'object' || schema === null) return undefined;
  const obj = schema as Record<string, unknown>;
  if (typeof obj.$ref === 'string') return obj.$ref;
  if (Array.isArray(obj.allOf)) {
    for (const part of obj.allOf) {
      const r = refOf(part);
      if (r) return r;
    }
  }
  return undefined;
};

describe('openapi.json contract', () => {
  it('exposes a non-trivial number of endpoints', () => {
    expect(operations.length).toBeGreaterThan(10);
  });

  it.each(operations.map(o => [`${o.method.toUpperCase()} ${o.path}`, o]))(
    '%s has a stable operationId',
    (_label, { op }) => {
      expect(op.operationId).toMatch(/^[A-Z][A-Za-z0-9]+_[a-z][A-Za-z0-9]*$/);
    },
  );

  it.each(
    operations
      .filter(o => ['post', 'put', 'patch'].includes(o.method))
      .filter(o => !POST_WITHOUT_BODY_ALLOWLIST.has(o.path))
      .map(o => [`${o.method.toUpperCase()} ${o.path}`, o]),
  )('%s declares a requestBody', (_label, { op }) => {
    expect(op.requestBody).toBeDefined();
  });

  it.each(operations.map(o => [`${o.method.toUpperCase()} ${o.path}`, o]))(
    '%s error responses (4xx/5xx) reference ErrorResponseDto',
    (_label, { op }) => {
      const errorResponses = Object.entries(op.responses ?? {}).filter(
        ([code]) => ERROR_CODE_RE.test(code),
      );
      // Endpoints may legitimately document no errors (rare); skip if so.
      if (errorResponses.length === 0) return;
      for (const [, resp] of errorResponses) {
        // Some endpoints (e.g. SSE) declare a non-JSON content-type; ErrorResponseDto
        // is still emitted under whichever content-type the operation produces.
        const firstContent = Object.values(resp.content ?? {})[0];
        expect(refOf(firstContent?.schema)).toBe(errorResponseRef);
      }
    },
  );

  it('every component schema has properties or is an enum', () => {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      const isUsable = !!schema.properties || Array.isArray(schema.enum);
      expect({ name, isUsable }).toEqual({ name, isUsable: true });
    }
  });
});
