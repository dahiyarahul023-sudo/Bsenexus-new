import React from 'react';
export function ListPagination({ current, pages, total, onPage }: { current: number; pages: number; total: number; onPage: (page: number) => void }) {
  if (!total) return null;
  return <nav aria-label="List pages" className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
    <span role="status">Page {current} of {pages} · {total} records</span>
    <div className="flex gap-2">
      <button type="button" className="rich-action rich-action-secondary px-3 py-2 rounded-xl disabled:opacity-40" disabled={current <= 1} onClick={() => onPage(current - 1)}>Previous</button>
      <button type="button" className="rich-action rich-action-secondary px-3 py-2 rounded-xl disabled:opacity-40" disabled={current >= pages} onClick={() => onPage(current + 1)}>Next</button>
    </div>
  </nav>;
}
