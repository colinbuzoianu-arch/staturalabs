// biome-ignore-all lint/suspicious/noArrayIndexKey: fixed-order presentational lists (columns config, static timeline)
import type { ReactNode } from "react";
import { cn } from "./cn";

// Presentational data table (SLD_RESTRUCTURE_PLAN_platform-modules.md §5.2).
// This is the visual shell only — sort/filter/column-chooser/saved-views are
// specified for the full build (they need client state and, for the header
// menus, the Radix dropdown proposed in the showcase). The point here is the
// look: sunken header row, hairline row dividers, comfortable desk density.
export type Column<T> = {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
}: {
  columns: ReadonlyArray<Column<T>>;
  rows: readonly T[];
  getRowKey: (row: T, index: number) => string;
  empty?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-sunken text-left">
            {columns.map((c, i) => (
              <th
                key={i}
                className={cn(
                  "px-4 py-2.5 font-medium text-foreground-muted",
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-foreground-subtle"
              >
                {empty ?? "Keine Einträge"}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                className="border-t border-border bg-surface-raised hover:bg-surface"
              >
                {columns.map((c, j) => (
                  <td
                    key={j}
                    className={cn("px-4 py-2.5 text-foreground", c.className)}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
