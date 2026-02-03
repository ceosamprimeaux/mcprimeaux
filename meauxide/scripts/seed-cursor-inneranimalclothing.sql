-- Cursor Pro+ usage for inneranimalclothing@gmail.com (Sam Primeaux)
-- Sourced from Cursor Billing UI (no CSV export available).
-- On-Demand cycle 22 Dec 2025 (line items) + Feb 2026 invoice.

INSERT INTO ai_usage_log (id, date, provider, model, tokens_input, tokens_output, cost_estimate, endpoint, account, created_at) VALUES
('cursor-inner-1', '2025-12-28', 'Cursor', 'claude-4.5-opus-high-thinking', 31000000, 0, 32.68, 'manual', 'inneranimalclothing@gmail.com', unixepoch()),
('cursor-inner-2', '2025-12-28', 'Cursor', 'non-max-claude-4.5-sonnet-thinking', 15400000, 0, 15.52, 'manual', 'inneranimalclothing@gmail.com', unixepoch()),
('cursor-inner-3', '2025-12-28', 'Cursor', 'non-max-claude-4.5-opus-high-thinking', 6800000, 0, 2.91, 'manual', 'inneranimalclothing@gmail.com', unixepoch()),
('cursor-inner-4', '2026-02-01', 'Cursor', 'Cursor Pro+ cycle Dec 30', 0, 0, 31.86, 'invoice', 'inneranimalclothing@gmail.com', unixepoch());
