-- Cursor invoice history for meauxbility@gmail.com (Sam Primeaux)
-- For assurance: billed amounts. CSV already has per-request usage for this account;
-- these rows are invoice totals only. (Chart may double-count if both CSV usage and
-- these invoice rows are summed for the same period.)

INSERT INTO ai_usage_log (id, date, provider, model, tokens_input, tokens_output, cost_estimate, endpoint, account, created_at) VALUES
('cursor-meaux-inv-1', '2026-01-29', 'Cursor', 'Invoice: non-max-default (1181 calls)', 12416881, 1818267, 44.00, 'invoice', 'meauxbility@gmail.com', unixepoch()),
('cursor-meaux-inv-2', '2026-01-27', 'Cursor', 'Invoice: non-max-default (317 calls)', 4757172, 681478, 22.57, 'invoice', 'meauxbility@gmail.com', unixepoch()),
('cursor-meaux-inv-3', '2026-01-24', 'Cursor', 'Cursor Pro', 0, 0, 21.80, 'invoice', 'meauxbility@gmail.com', unixepoch()),
('cursor-meaux-inv-4', '2025-11-29', 'Cursor', 'Trial Cursor Pro', 0, 0, 0.00, 'invoice', 'meauxbility@gmail.com', unixepoch());
