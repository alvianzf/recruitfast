import { useMemo, useState } from "react";

// Shared client-side pagination for the plain <Table>/list screens that
// don't go through DataGrid (which already paginates itself) — every
// list/table in the app should paginate once it can plausibly grow past
// one screen. See docs/13-redesign.md.
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paged = useMemo(
    () => items.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize),
    [items, clampedPage, pageSize],
  );

  return { page: clampedPage, setPage, pageCount, paged, pageSize };
}
