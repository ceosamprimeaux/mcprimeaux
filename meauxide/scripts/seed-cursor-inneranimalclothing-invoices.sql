-- Cursor invoice history for inneranimalclothing@gmail.com (Sam Primeaux)
-- Supplemental: adds remaining invoices (initial seed had Dec 28 usage + Feb 1).
-- One row per invoice line = amount paid on that date.

INSERT INTO ai_usage_log (id, date, provider, model, tokens_input, tokens_output, cost_estimate, endpoint, account, created_at) VALUES
('cursor-inner-5', '2026-01-30', 'Cursor', 'Cursor Pro Plus', 0, 0, 65.40, 'invoice', 'inneranimalclothing@gmail.com', unixepoch()),
('cursor-inner-6', '2026-01-23', 'Cursor', 'non-max-default (696 calls)', 7363805, 957354, 43.60, 'invoice', 'inneranimalclothing@gmail.com', unixepoch()),
('cursor-inner-7', '2026-01-01', 'Cursor', 'claude-4.5-opus-high-thinking (314 calls)', 6486, 237332, 32.61, 'invoice', 'inneranimalclothing@gmail.com', unixepoch()),
('cursor-inner-8', '2025-12-30', 'Cursor', 'Cursor Pro Plus', 0, 0, 65.40, 'invoice', 'inneranimalclothing@gmail.com', unixepoch()),
('cursor-inner-9', '2025-12-23', 'Cursor', 'claude-4.5-opus-high-thinking (168 calls)', 3421, 133124, 21.89, 'invoice', 'inneranimalclothing@gmail.com', unixepoch()),
('cursor-inner-10', '2025-12-22', 'Cursor', 'Cursor Pro', 0, 0, 21.80, 'invoice', 'inneranimalclothing@gmail.com', unixepoch()),
('cursor-inner-11', '2025-12-22', 'Cursor', 'Trial Cursor Pro', 0, 0, 0.00, 'invoice', 'inneranimalclothing@gmail.com', unixepoch());
