import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  label?: string;
  onPageChange: (p: number) => void;
};

function buildPages(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (page > 3) pages.push("…");
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
  if (page < totalPages - 2) pages.push("…");
  pages.push(totalPages);
  return pages;
}

export function Pagination({ page, totalPages, total, label = "registros", onPageChange }: Props) {
  if (totalPages <= 1 && total === 0) return null;

  const from = (page - 1) * 20 + 1;
  const to = Math.min(page * 20, total);
  const pages = buildPages(page, totalPages);

  return (
    <div className="pagination">
      <span className="pagination-info">
        {total === 0 ? "0 registros" : `${from}–${to} de ${total} ${label}`}
      </span>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="pg-btn"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label="Anterior"
          >
            <ChevronLeft size={15} />
          </button>

          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`d${i}`} className="pg-dots">…</span>
            ) : (
              <button
                key={p}
                className={`pg-btn${p === page ? " active" : ""}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            )
          )}

          <button
            className="pg-btn"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            aria-label="Próxima"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
