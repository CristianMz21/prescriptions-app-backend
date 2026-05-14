/* Copyright (c) 2026. All rights reserved. */
import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedResultDto } from '../dto/paginated-result.dto';
import { PaginationMetaDto } from '../dto/pagination-meta.dto';

/**
 * Builds the OpenAPI schema for a paginated response wrapping items of `itemType`.
 * Mirrors the `{ data: T[], meta: PaginationMeta }` shape used across controllers.
 */
export function paginatedSchema(itemType: Type<unknown>) {
  return {
    allOf: [
      { $ref: getSchemaPath(PaginatedResultDto) },
      {
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(itemType) },
          },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    ],
  };
}

/**
 * Convenience decorator: documents a 200 OK paginated response of `itemType`.
 */
export const apiPaginatedOkResponse = (
  itemType: Type<unknown>,
  description: string,
) =>
  applyDecorators(
    ApiOkResponse({ schema: paginatedSchema(itemType), description }),
  );
