import { createFileRoute, Link } from "@tanstack/react-router";
import { useAwardsData } from "./awards";

export const Route = createFileRoute("/awards/")({
  component: AwardsHome,
  head: () => ({
    meta: [{ title: "Daegon Awards — daegon charts" }],
  }),
});

const EDITIONS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];

function AwardsHome() {
  const { loaded } = useAwardsData();

  return (
    <div>
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-[var(--foreground)] mb-3" style={{ fontFamily: "Times New Roman, serif" }}>Daegon Music Awards</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">Celebrating excellence in music across multiple genres and categories. Explore past editions, winners, and nominees.</p>
      </div>
      {!loaded ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin mb-4" />
          <span className="text-muted-foreground text-sm">Loading editions...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {EDITIONS.map((year) => (
            <Link
              key={year}
              to="/awards/$year"
              params={{ year: String(year) }}
              className="group border-2 border-[var(--accent)] rounded-lg p-6 text-center transition-all duration-300 hover:bg-[var(--accent)] hover:text-black bg-[var(--card)]"
            >
              <div className="text-3xl font-bold text-[var(--accent)] group-hover:text-black transition-colors" style={{ fontFamily: "Times New Roman, serif" }}>{year}</div>
              <div className="text-xs font-semibold tracking-widest opacity-80 mt-1">EDITION</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
