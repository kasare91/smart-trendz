import { ValidationError } from './errors';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function getPagination(searchParams: URLSearchParams) {
  const page = parsePositiveInt(searchParams.get('page'), 1);
  const requestedPageSize = parsePositiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginationResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
) {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError('Pagination values must be positive integers');
  }

  return parsed;
}
