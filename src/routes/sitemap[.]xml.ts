import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getWeeklyChart, getAllArtistStats } from "@/lib/charts.functions";
import { weeklyChartIds, yearEndChartIds, goatChartIds, slugifyArtist } from "@/lib/charts-config";

const BASE_URL = "https://daegoncharts.com.br";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const paths: string[] = ["/", "/artists", "/albums", "/songs", "/number-ones", "/stats", "/chart-battle"];
        for (const id of weeklyChartIds) {
          paths.push(`/chart/${id}`);
          try {
            const d = await getWeeklyChart({ data: { chartId: id } });
            for (const date of d.dates.slice(-12)) paths.push(`/chart/${id}/${date}`);
          } catch {}
        }
        for (const id of yearEndChartIds) paths.push(`/year-end/${id}`);
        for (const id of goatChartIds) paths.push(`/goat/${id}`);
        try {
          const artistStats = await getAllArtistStats();
          for (const a of Object.values(artistStats)) {
            paths.push(`/artist/${slugifyArtist(a.name)}`);
          }
        } catch {}
        const urls = paths.map((p) => `  <url><loc>${BASE_URL}${p}</loc></url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "content-type": "application/xml", "cache-control": "public, max-age=3600" } });
      },
    },
  },
});
