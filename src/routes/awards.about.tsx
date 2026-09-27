import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/awards/about")({
  component: AwardsAbout,
  head: () => ({
    meta: [{ title: "About — Daegon Awards" }],
  }),
});

function AwardsAbout() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[var(--accent)] flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-[var(--foreground)]" style={{ fontFamily: "Times New Roman, serif" }}>About Daegon Awards</h2>
        <Link to="/awards" className="flex items-center gap-2 bg-[var(--accent)] text-black px-4 py-2 rounded-md font-semibold text-sm hover:opacity-90 transition-colors">
          <i className="fas fa-arrow-left" /> Back to Home
        </Link>
      </div>
      <div className="max-w-3xl mx-auto space-y-10">
        <div>
          <h3 className="text-2xl font-semibold text-[var(--foreground)] mb-3">Our Mission</h3>
          <p className="text-muted-foreground leading-relaxed">
            The Daegon Awards were established to recognize and celebrate exceptional talent in the music industry. Our goal is to honor artists, producers, and contributors who have made significant impacts through their creative work.
          </p>
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-[var(--foreground)] mb-3">Selection Process</h3>
          <p className="text-muted-foreground leading-relaxed">
            Nominees are selected by a panel of industry experts, and winners are chosen based on artistic merit, innovation, and cultural impact. The process is designed to be fair, transparent, and comprehensive.
          </p>
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-[var(--foreground)] mb-3">Data Source</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            All award data is sourced from publicly available Google Sheets that document the nominations and winners for each edition of the Daegon Awards from 2017 to 2025.
          </p>
          <a
            href="https://docs.google.com/spreadsheets/d/1DNb6uYi6K231-fhrSt3XPlaag8eG9ZFVHhvSXyjWCuk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[var(--accent)] text-black px-5 py-3 rounded-md font-semibold hover:opacity-90 transition-colors"
          >
            <i className="fas fa-external-link-alt" /> View Data Source
          </a>
        </div>
      </div>
    </div>
  );
}
