/* Copyright (c) 2026. All rights reserved. */
export const UNAUTHORIZED_DESC = 'Unauthorized — valid access token required';
export const FORBIDDEN_ADMIN_DESC = 'Forbidden — Admin role required';
export const FORBIDDEN_DOCTOR_DESC = 'Forbidden — Doctor role required';
export const FORBIDDEN_ADMIN_OR_DOCTOR_DESC =
  'Forbidden — Admin or Doctor role required';
export const BAD_REQUEST_QUERY_DESC = 'Bad Request — invalid query parameters';

export const STANDARD_ERROR_DESC: Readonly<
  Record<400 | 401 | 403 | 404 | 409 | 422, string>
> = {
  400: 'Bad Request — payload validation failed',
  401: UNAUTHORIZED_DESC,
  403: 'Forbidden — insufficient permissions',
  404: 'Not Found — resource does not exist',
  409: 'Conflict — resource state prevents the operation',
  422: 'Unprocessable Entity — referenced resource is invalid or not found',
};
