import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAwardsData } from "./awards";

export const Route = createFileRoute("/awards/categories")({
  component: AwardsCategories,
  head: () => ({
    meta: [{ title: "Categories — Daegon Awards" }],
  }),
});

function AwardsCategories() {
  const { allData, loaded } = useAwardsData();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const editions = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[var(--accent)] flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-[var(--foreground)]" style={{ fontFamily: "Times New Roman, serif" }}>All Categories</h2>
        <Link to="/awards" className="flex items-center gap-2 bg-[var(--accent)] text-black px-4 py-2 rounded-md font-semibold text-sm hover:opacity-90 transition-colors">
          <i className="fas fa-arrow-left" /> Back to Home
        </Link>
      </div>
      {!loaded ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin mb-4" />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {editions.map((year) => {
            const yearData = allData.find((d) => {
              const firstKey = Object.keys(d.categories)[0];
              return firstKey && d.categories[firstKey]?.some((n) => n.year === year);
            });
            if (!yearData || Object.keys(yearData.categories).length === 0) return null;
            const isCollapsed = collapsed.has(String(year));
            return (
              <div key={year} className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--card)]">
                <button
                  onClick={() => toggle(String(year))}
                  className="w-full bg-[var(--accent)] text-black px-5 py-3 flex items-center justify-between cursor-pointer hover:opacity-90 transition-colors"
                >
                  <span className="text-lg font-semibold" style={{ fontFamily: "Times New Roman, serif" }}>{year} Edition</span>
                  <span className="text-xl">{isCollapsed ? "+" : "\u2212"}</span>
                </button>
                {!isCollapsed && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.keys(yearData.categories).sort().map((cat) => {
                          return (
                        <Link
                          key={cat}
                          to="/awards/$year"
                          params={{ year: String(year) }}
                          className="text-left p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors bg-[var(--background)]"
                        >
                          <div className="font-semibold text-[var(--foreground)] text-sm">{cat}</div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
