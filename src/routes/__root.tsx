import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, type ReactNode, useState, useRef, useCallback } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BackToTop } from "@/components/chart-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { CommandSearch } from "@/components/command-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorBoundary } from "@/components/error-boundary";
import { trackPageView } from "@/lib/analytics";
import { AudioPlayerBar } from "@/components/audio-player";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-question text-3xl text-[var(--accent)]" />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--foreground)] mb-2">Page not found</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-8">This chart week or page doesn't exist.</p>
        <Link to="/" className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity inline-block">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-exclamation-triangle text-3xl text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--foreground)] mb-2">This page didn't load</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-8">Try again in a moment.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity"
          >
            <i className="fas fa-redo mr-2" />Try again
          </button>
          <a href="/" className="px-6 py-2.5 rounded-full border border-[var(--border)] text-[var(--foreground)] font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function PendingComponent() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-12 w-64 bg-[var(--muted)]" />
        <Skeleton className="h-8 w-48 bg-[var(--muted)]" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="chart-card w-full">
            <div className="hidden md:grid gap-3 items-center" style={{ gridTemplateColumns: "auto auto auto minmax(0,1fr) auto" }}>
              <Skeleton className="w-16 h-12 bg-[var(--muted)]" />
              <Skeleton className="w-24 h-24 bg-[var(--muted)]" />
              <Skeleton className="w-8 h-8 bg-[var(--muted)]" />
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton className="h-5 w-3/4 bg-[var(--muted)]" />
                <Skeleton className="h-4 w-1/2 bg-[var(--muted)]" />
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-3 w-16 bg-[var(--muted)]" />
                  <Skeleton className="h-3 w-16 bg-[var(--muted)]" />
                  <Skeleton className="h-3 w-16 bg-[var(--muted)]" />
                </div>
              </div>
            </div>
            <div className="md:hidden flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <Skeleton className="w-10 h-10 bg-[var(--muted)]" />
                <Skeleton className="w-14 h-14 bg-[var(--muted)]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 bg-[var(--muted)]" />
                  <Skeleton className="h-3 w-1/2 bg-[var(--muted)]" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingBar() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = router.subscribe("onBeforeNavigate", () => {
      setLoading(true);
    });
    const unsub2 = router.subscribe("onResolved", () => {
      setLoading(false);
    });
    return () => { unsub(); unsub2(); };
  }, [router]);

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-1 overflow-hidden">
      <div
        className={`h-full bg-[var(--accent)] transition-all duration-300 ${
          loading
            ? "w-3/4 animate-loading-bar"
            : "w-0"
        }`}
      />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "daegon charts — weekly music charts" },
      { name: "description", content: "Weekly music charts, year-end rankings and greatest of all time lists based on dantaswt's Last.fm data. Each week gets its own shareable page." },
      { property: "og:title", content: "daegon charts — weekly music charts" },
      { property: "og:description", content: "Weekly music charts, year-end rankings and greatest of all time lists based on dantaswt's Last.fm data. Each week gets its own shareable page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "daegon charts — weekly music charts" },
      { name: "twitter:description", content: "Weekly music charts, year-end rankings and greatest of all time lists based on dantaswt's Last.fm data. Each week gets its own shareable page." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ec607b97-ae27-46db-b1cd-33cd5ee21c48/id-preview-d264bb45--5db350f4-251b-4e58-9690-0882b7b15f41.lovable.app-1783601743675.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ec607b97-ae27-46db-b1cd-33cd5ee21c48/id-preview-d264bb45--5db350f4-251b-4e58-9690-0882b7b15f41.lovable.app-1783601743675.png" },
    ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "https://i.imgur.com/jaBZ19n.png", type: "image/png" },
        { rel: "stylesheet", href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" },
      ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  pendingComponent: PendingComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5838624736955714"
          crossOrigin="anonymous"
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const toggleMobileMenu = useCallback(() => setMenuOpen((open) => !open), []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const navItems = [
    { label: "DAEGON 100", to: "/chart/$chartId" as const, params: { chartId: "songs" } },
    { label: "CHART BEAT", to: "/chart-beat-2/$chartId/$date" as const, params: { chartId: "songs", date: "2026-07-06" } },
    { label: "YEAR-END CHARTS", to: "/year-end" as const },
    { label: "DECADE-END", to: "/decade-end" as const },
    { label: "GREATEST OF ALL TIME", to: "/goat" as const },
    { label: "STATS", to: "/stats" as const, params: {} },
    { label: "AWARDS", to: "/awards" as const, params: {} },
    { label: "#1'S", to: "/number-ones" as const, params: {} },
    { label: "ABOUT", to: "/about" as const, params: {} },
  ];

  return (
    <header ref={headerRef} className="fixed top-0 left-0 right-0 z-[100] isolate pointer-events-auto bg-gradient-to-b from-[#0f0f0f] to-[#161616] border-b border-[#2a2a2a]">
      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between max-w-7xl mx-auto px-4 py-3">
        <Link to="/" className="text-xl font-extrabold text-[#f5f5f5] lowercase tracking-wide shrink-0 mr-4">
          daegon charts
        </Link>
        <nav className="flex items-center justify-center gap-2 flex-1 min-w-0">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              params={item.params}
              className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#9CA3AF] hover:text-[#f5f5f5] transition-colors whitespace-nowrap shrink-0"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 shrink-0 ml-4">
          <CommandSearch />
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile header — title truly centered */}
      <div className="lg:hidden relative flex items-center justify-between px-4 py-3">
        <div className="relative z-[120] w-11 h-11 flex items-center justify-center flex-shrink-0 pointer-events-auto">
          <button
            type="button"
            onClick={toggleMobileMenu}
            className="relative z-[121] pointer-events-auto select-none w-11 h-11 flex items-center justify-center text-[#f5f5f5] text-2xl cursor-pointer touch-manipulation active:scale-95 transition-transform [-webkit-tap-highlight-color:transparent]"
            aria-label="Menu"
          >
            <i className={`fas ${menuOpen ? "fa-times" : "fa-bars"}`} />
          </button>
        </div>
        <Link
          to="/"
          className="absolute left-16 right-16 z-10 text-center text-lg font-extrabold text-[#f5f5f5] lowercase tracking-wide pointer-events-auto"
        >
          daegon charts
        </Link>
        <div className="relative z-[120] w-11 h-11 flex items-center justify-center flex-shrink-0 pointer-events-auto touch-manipulation">
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden relative z-[110] pointer-events-auto bg-[#0f0f0f] border-t border-[#2a2a2a]">
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                params={item.params}
                onClick={() => setMenuOpen(false)}
                className="block text-sm font-bold uppercase tracking-widest text-[#9CA3AF] hover:text-[var(--accent)] transition-colors py-2 border-b border-[#2a2a2a]"
              >
                {item.label}
              </Link>
            ))}
            {/* Mobile search trigger */}
            <div className="pt-2">
              <CommandSearch />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-[#0f0f0f] mt-10 py-8 border-t border-[#2a2a2a]">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground mb-6">
          <Link to="/artists" className="hover:text-[var(--accent)] transition-colors font-semibold">Artists</Link>
          <span className="text-[#9CA3AF]">|</span>
          <Link to="/albums" className="hover:text-[var(--accent)] transition-colors font-semibold">Albums</Link>
          <span className="text-[#9CA3AF]">|</span>
          <Link to="/songs" className="hover:text-[var(--accent)] transition-colors font-semibold">Songs</Link>
        </div>
        <div className="text-center text-muted-foreground text-xs">
          <p>Chart generated based on daegon charts archive.</p>
          <p className="mt-1">Powered by TanStack Start.</p>
        </div>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    trackPageView(window.location.pathname);
  }, [router.state.location]);

  return (
    <QueryClientProvider client={queryClient}>
      <LoadingBar />
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <main className="flex-grow container mx-auto p-3 md:p-6 pt-20 md:pt-24">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <SiteFooter />
        <BackToTop />
        <AudioPlayerBar />
      </div>
    </QueryClientProvider>
  );
}
