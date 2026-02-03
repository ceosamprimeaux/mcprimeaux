-- Add account (email) to AI usage for Cursor/Claude/ChatGPT per-account tracking
ALTER TABLE ai_usage_log ADD COLUMN account TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_usage_account ON ai_usage_log(account);
