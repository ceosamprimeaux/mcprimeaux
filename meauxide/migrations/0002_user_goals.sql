-- User goal (car/savings): one row per user; default = primary user
CREATE TABLE IF NOT EXISTS user_goals (
  id TEXT PRIMARY KEY,
  goal_saved REAL NOT NULL DEFAULT 0,
  goal_paid_off REAL NOT NULL DEFAULT 0,
  goal_owed REAL NOT NULL DEFAULT 0,
  goal_monthly_payment REAL NOT NULL DEFAULT 0,
  goal_target_label TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Seed primary user: paid off $6,800 on old car, $4,000 owed, -$450/mo
INSERT OR REPLACE INTO user_goals (id, goal_saved, goal_paid_off, goal_owed, goal_monthly_payment, goal_target_label)
VALUES ('default', 0, 6800, 4000, 450, 'Cadillac CTS-V');
