-- Finance tracking: income/expense entries from DB
CREATE TABLE IF NOT EXISTS finance_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_entries(date);
CREATE INDEX IF NOT EXISTS idx_finance_category ON finance_entries(category);

-- AI / API spend (neuron) tracking: one row per API call
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_estimate REAL DEFAULT 0,
  endpoint TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_log(date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage_log(provider);
