import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/chart/$chartId")({
  component: () => <Outlet />,
});
