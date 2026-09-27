const ANALYTICS_KEY = "daegon_analytics";

interface PageView {
  path: string;
  count: number;
  lastVisited: number;
}

function loadAnalytics(): Record<string, PageView> {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAnalytics(data: Record<string, PageView>) {
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
}

export function trackPageView(path: string) {
  const data = loadAnalytics();
  const existing = data[path];
  data[path] = {
    path,
    count: existing ? existing.count + 1 : 1,
    lastVisited: Date.now(),
  };
  saveAnalytics(data);
}

export function getTopPages(limit = 10): PageView[] {
  const data = loadAnalytics();
  return Object.values(data)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getTotalViews(): number {
  const data = loadAnalytics();
  return Object.values(data).reduce((sum, p) => sum + p.count, 0);
}
