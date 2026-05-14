/* Copyright (c) 2026. All rights reserved. */
import { Prisma } from '@prisma/client';
import { SortOrder } from '../dto/list-query.dto';

/**
 * Build a Prisma DateTimeFilter from optional ISO date strings. Returns
 * undefined when neither bound is provided so the caller can spread the
 * result conditionally without polluting the where clause with empty filters.
 */
export const dateRangeFilter = (
  fromIso?: string,
  toIso?: string,
): Prisma.DateTimeFilter | undefined => {
  if (!fromIso && !toIso) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (fromIso) filter.gte = new Date(fromIso);
  if (toIso) filter.lte = new Date(toIso);
  return filter;
};

/**
 * Build a Prisma case-insensitive `contains` filter, or undefined when the
 * input is empty/whitespace.
 */
export const caseInsensitiveContains = (
  value?: string,
): Prisma.StringFilter | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return { contains: trimmed, mode: 'insensitive' };
};

/**
 * Compute a Date representing `years` ago from `reference` (default: now).
 * Used for `minAge`/`maxAge` filters that resolve to birthDate ranges.
 *
 * Naive implementation: subtracts whole years. Acceptable for filter
 * granularity; not for legal age calculations.
 */
export const yearsAgo = (years: number, reference: Date = new Date()): Date => {
  const d = new Date(reference);
  d.setFullYear(d.getFullYear() - years);
  return d;
};

/**
 * Map a DTO `SortOrder` enum to Prisma's literal sort direction.
 * Defaults to descending when omitted.
 */
export const toPrismaSort = (order?: SortOrder): Prisma.SortOrder =>
  order === SortOrder.Asc ? 'asc' : 'desc';
