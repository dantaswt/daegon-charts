import { createFileRoute, redirect } from "@tanstack/react-router";
import { getWeeklyChart } from "@/lib/charts.functions";
import { weeklyChartIds } from "@/lib/charts-config";

export const Route = createFileRoute("/chart/$chartId/")({
  loader: async ({ params }) => {
    if (!weeklyChartIds.includes(params.chartId)) throw new Error("Unknown chart");
    const data = await getWeeklyChart({ data: { chartId: params.chartId } });
    const latest = data.dates[data.dates.length - 1];
    if (!latest) throw new Error("No dates for chart");
    throw redirect({
      to: "/chart/$chartId/$date",
      params: { chartId: params.chartId, date: latest },
    });
  },
  component: () => null,
});
