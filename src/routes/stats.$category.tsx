import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/stats/$category")({
  loader: () => {
    throw redirect({ to: "/stats" });
  },
  head: () => ({ meta: [{ title: "Stats | daegon charts" }] }),
  component: () => null,
});
