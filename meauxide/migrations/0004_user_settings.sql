-- Optional key-value store for user preferences (e.g. Cursor spend cap).
CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
