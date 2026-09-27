CREATE TABLE IF NOT EXISTS chart_data (
  id BIGSERIAL PRIMARY KEY,
  chart_type TEXT NOT NULL,
  chart_id TEXT NOT NULL,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chart_type, chart_id)
);

CREATE INDEX IF NOT EXISTS idx_chart_type_id ON chart_data(chart_type, chart_id);
