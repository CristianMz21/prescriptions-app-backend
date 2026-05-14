/* Copyright (c) 2026. All rights reserved. */
import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { STANDARD_ERROR_DESC } from './swagger-descriptions';

type StandardErrorCode = 400 | 401 | 403 | 404 | 409 | 422;

const RESPONSE_BY_CODE = {
  400: ApiBadRequestResponse,
  401: ApiUnauthorizedResponse,
  403: ApiForbiddenResponse,
  404: ApiNotFoundResponse,
  409: ApiConflictResponse,
  422: ApiUnprocessableEntityResponse,
} as const satisfies Record<StandardErrorCode, unknown>;

export type StandardErrorMap = Partial<
  Record<StandardErrorCode, true | string>
>;

/**
 * Documents standard error responses with `ErrorResponseDto`.
 *
 * Pass `true` to use the canonical description from `STANDARD_ERROR_DESC`,
 * or a string to override.
 *
 * @example
 *   `@ApiStandardErrors({ 400: true, 401: true, 403: FORBIDDEN_DOCTOR_DESC, 404: true })`
 */
export const ApiStandardErrors = (errors: StandardErrorMap) =>
  applyDecorators(
    ...(
      Object.entries(errors) as Array<[`${StandardErrorCode}`, true | string]>
    ).map(([code, value]) => {
      const numeric = Number(code) as StandardErrorCode;
      const description =
        typeof value === 'string' ? value : STANDARD_ERROR_DESC[numeric];
      return RESPONSE_BY_CODE[numeric]({
        type: ErrorResponseDto,
        description,
      });
    }),
  );
