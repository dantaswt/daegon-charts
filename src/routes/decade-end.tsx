import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/decade-end")({
  head: () => ({ meta: [{ title: "Decade-End Charts | daegon charts" }] }),
  component: DecadeEndLayout,
});

function DecadeEndLayout() {
  return <Outlet />;
}
