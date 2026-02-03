/**
 * MeauxIDE Worker — R2, D1, Workers AI, Vectorize, AutoRAG
 * Serves static assets and /api/* with full Cloudflare bindings.
 */

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  /** Optional: set via wrangler secret put CURSOR_API_KEY. Used when Cursor exposes a usage API; OAuth later. */
  CURSOR_API_KEY?: string;
  /** Cloudflare Images: account hash for imagedelivery.net (vars); account ID + token for API */
  CLOUDFLARE_IMAGES_ACCOUNT_HASH?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  /** Set via wrangler secret put CLOUDFLARE_IMAGES_API_TOKEN. Use a dedicated token with Images read/edit, Stream read/edit, Account Analytics. */
  CLOUDFLARE_IMAGES_API_TOKEN?: string;
}

const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
const CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

/** SPA routes: serve index.html so client router can handle them. Avoids R2/Assets 404 for /dashboard etc. */
const SPA_FALLBACK_PATH = "/";
function isSpaRoute(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === "/" || p === "/login" || p === "/dashboard" || p.startsWith("/dashboard/");
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }
    // For SPA routes, request index (/) from ASSETS so we always get the app, not a 404.
    const method = request.method;
    if ((method === "GET" || method === "HEAD") && isSpaRoute(url.pathname)) {
      const root = new URL(SPA_FALLBACK_PATH, url.origin);
      const spaRequest = new Request(root.toString(), { method, headers: request.headers });
      return env.ASSETS.fetch(spaRequest);
    }
    return env.ASSETS.fetch(request);
  },
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const path = url.pathname.replace(/^\/api\/?/, "") || "health";
  const method = request.method;

  try {
    let res: Response;
    if (path === "health") res = await apiHealth(env);
    else if (path === "dashboard") res = await apiDashboard(env);
    else if (path === "projects") res = await apiProjects(env);
    else if (path === "library") res = await apiLibrary(env);
    else if (path === "analytics/finance") res = request.method === "POST" ? await apiAnalyticsFinancePost(request, env) : await apiAnalyticsFinance(env, url);
    else if (path === "analytics/neurons") res = await apiAnalyticsNeurons(env, url);
    else if (path === "analytics/neurons/import" && method === "POST") res = await apiAnalyticsNeuronsImport(request, env);
    else if (path === "user/goal") res = method === "PUT" || method === "PATCH" ? await apiUserGoalPut(request, env) : await apiUserGoalGet(env);
    else if (path === "r2" || path.startsWith("r2/")) res = await apiR2(request, env, path === "r2" ? "" : path.slice(3), method, url);
    else if (path === "ai/generate") res = await apiAIGenerate(request, env);
    else if (path === "vectorize/query") res = await apiVectorizeQuery(request, env);
    else if (path === "vectorize/insert") res = await apiVectorizeInsert(request, env);
    else if (path === "rag") res = await apiRag(request, env);
    else if (path === "cursor/status") res = await apiCursorStatus(env);
    else if (path === "cursor/spend-cap" && method === "GET") res = await apiCursorSpendCapGet(env);
    else if (path === "cursor/spend-cap" && (method === "PUT" || method === "PATCH")) res = await apiCursorSpendCapPut(request, env);
    else if (path === "cursor/agent" && method === "POST") res = await apiCursorAgentPost(request, env);
    else if (path === "cursor/models" && method === "GET") res = await apiCursorModels(env);
    else if (path === "images" && method === "GET") res = await apiImagesList(env, url);
    else if (path === "images" && method === "POST") res = await apiImagesUpload(request, env);
    else if (path.startsWith("images/")) {
      const imageId = path.slice(7).replace(/\/$/, "");
      if (imageId && method === "GET") res = await apiImagesGet(env, imageId);
      else if (imageId && method === "DELETE") res = await apiImagesDelete(env, imageId);
      else res = json({ error: "Not found" }, 404);
    } else res = json({ error: "Not found" }, 404);
    return withCors(res);
  } catch (e) {
    console.error(e);
    return withCors(json({ error: e instanceof Error ? e.message : "Internal error" }, 500));
  }
}

function withCors(res: Response): Response {
  const r = new Response(res.body, { status: res.status, headers: res.headers });
  Object.entries(CORS_HEADERS).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}

// --- D1 ---
async function apiHealth(env: Env): Promise<Response> {
  if (!env.DB) return json({ ok: false, db: "no binding" }, 503);
  try {
    const row = await env.DB.prepare("SELECT 1 as ping").first();
    return json({ ok: true, db: "connected", ping: (row as { ping?: number })?.ping ?? 1 });
  } catch (e) {
    return json({ ok: false, db: "error", error: String(e) }, 500);
  }
}

async function apiDashboard(env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "D1 binding not available" }, 503);
  const [configs, sessions, commands] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as count FROM agent_configs WHERE status = 'active'").first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) as count FROM agent_sessions WHERE status = 'active'").first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) as count FROM agent_commands WHERE status = 'active'").first<{ count: number }>(),
  ]);
  return json({
    ok: true,
    agent_configs: configs?.count ?? 0,
    active_sessions: sessions?.count ?? 0,
    agent_commands: commands?.count ?? 0,
    db: "connected",
  });
}

async function apiProjects(env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "D1 binding not available" }, 503);
  const { results } = await env.DB.prepare(
    "SELECT id, name, slug, description, config_type, status, version, updated_at FROM agent_configs ORDER BY updated_at DESC LIMIT 50"
  ).all();
  return json({ ok: true, rows: results ?? [] });
}

async function apiLibrary(env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "D1 binding not available" }, 503);
  const { results } = await env.DB.prepare(
    "SELECT id, name, slug, description, category, status, usage_count, updated_at FROM agent_commands ORDER BY usage_count DESC, updated_at DESC LIMIT 50"
  ).all();
  return json({ ok: true, rows: results ?? [] });
}

// --- Cursor connection & spend cap ---
const CURSOR_LINKS = {
  apiKeys: "https://cursor.com/docs/settings/api-keys",
  dashboard: "https://cursor.com/dashboard",
  billing: "https://cursor.com/docs/account/billing",
};

async function apiCursorStatus(env: Env): Promise<Response> {
  return json({
    ok: true,
    configured: Boolean(env.CURSOR_API_KEY),
    links: CURSOR_LINKS,
    note: "API key is for future Cursor usage API; OAuth coming later. Use Dashboard to export usage CSV.",
  });
}

async function apiCursorSpendCapGet(env: Env): Promise<Response> {
  if (!env.DB) return json({ ok: true, spend_cap_monthly: null });
  try {
    const row = await env.DB.prepare("SELECT value FROM user_settings WHERE key = 'cursor_spend_cap_monthly' LIMIT 1").first<{ value: string | null }>();
    const cap = row?.value != null ? parseFloat(row.value) : null;
    return json({ ok: true, spend_cap_monthly: Number.isFinite(cap) ? cap : null });
  } catch {
    return json({ ok: true, spend_cap_monthly: null });
  }
}

async function apiCursorSpendCapPut(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "D1 not available" }, 503);
  const body = await request.json().catch(() => null) as { spend_cap_monthly?: number } | null;
  const cap = body?.spend_cap_monthly;
  if (cap != null && (!Number.isFinite(cap) || cap < 0)) return json({ error: "spend_cap_monthly must be a non-negative number" }, 400);
  try {
    if (cap == null) {
      await env.DB.prepare("DELETE FROM user_settings WHERE key = 'cursor_spend_cap_monthly'").run();
      return json({ ok: true, spend_cap_monthly: null });
    }
    await env.DB.prepare("INSERT OR REPLACE INTO user_settings (key, value) VALUES ('cursor_spend_cap_monthly', ?)").bind(String(cap)).run();
    return json({ ok: true, spend_cap_monthly: cap });
  } catch (e) {
    return json({ error: "Failed to save. Run migrations/0004_user_settings.sql.", detail: String(e) }, 500);
  }
}

const CURSOR_API_BASE = "https://api.cursor.com/v0";

async function apiCursorAgentPost(request: Request, env: Env): Promise<Response> {
  if (!env.CURSOR_API_KEY) return json({ error: "CURSOR_API_KEY not configured. Add secret in Cloudflare dashboard or: npx wrangler secret put CURSOR_API_KEY" }, 503);
  const body = await request.json().catch(() => null) as {
    prompt?: { text?: string; images?: { data: string; dimension: { width: number; height: number } }[] };
    source?: { repository?: string; ref?: string };
    model?: string;
  } | null;
  const text = body?.prompt?.text?.trim();
  if (!text) return json({ error: "prompt.text required" }, 400);
  const repository = body?.source?.repository?.trim();
  const ref = body?.source?.ref?.trim() || "main";
  if (!repository) return json({ error: "source.repository required (e.g. https://github.com/owner/repo)" }, 400);
  const payload: Record<string, unknown> = {
    prompt: { text, ...(body?.prompt?.images?.length ? { images: body.prompt.images } : {}) },
    source: { repository, ref },
  };
  if (body?.model) payload.model = body.model;
  const res = await fetch(`${CURSOR_API_BASE}/agents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CURSOR_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: "Cursor API error", status: res.status, cursor: data }, res.status >= 500 ? 502 : res.status);
  return json({ ok: true, cursor: data });
}

async function apiCursorModels(env: Env): Promise<Response> {
  if (!env.CURSOR_API_KEY) return json({ error: "CURSOR_API_KEY not configured" }, 503);
  const res = await fetch(`${CURSOR_API_BASE}/models`, {
    method: "GET",
    headers: { Authorization: `Bearer ${env.CURSOR_API_KEY}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: "Cursor API error", status: res.status, cursor: data }, res.status >= 500 ? 502 : res.status);
  return json({ ok: true, models: Array.isArray(data) ? data : data?.models ?? [] });
}

// --- User goal (car / savings: paid off, owed, saved, monthly) ---
interface UserGoalRow {
  goal_saved: number;
  goal_paid_off: number;
  goal_owed: number;
  goal_monthly_payment: number;
  goal_target_label: string | null;
  updated_at: number;
}

async function apiUserGoalGet(env: Env): Promise<Response> {
  if (!env.DB) return json({ ok: false, error: "D1 not available" }, 503);
  try {
    const row = await env.DB.prepare(
      "SELECT goal_saved, goal_paid_off, goal_owed, goal_monthly_payment, goal_target_label, updated_at FROM user_goals WHERE id = 'default' LIMIT 1"
    ).first<UserGoalRow>();
    if (!row) {
      return json({
        ok: true,
        goal: {
          goal_saved: 0,
          goal_paid_off: 6800,
          goal_owed: 4000,
          goal_monthly_payment: 450,
          goal_target_label: "Cadillac CTS-V",
          updated_at: Math.floor(Date.now() / 1000),
        },
      });
    }
    return json({ ok: true, goal: row });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

async function apiUserGoalPut(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ ok: false, error: "D1 not available" }, 503);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const saved = typeof body.goal_saved === "number" ? body.goal_saved : undefined;
    const paidOff = typeof body.goal_paid_off === "number" ? body.goal_paid_off : undefined;
    const owed = typeof body.goal_owed === "number" ? body.goal_owed : undefined;
    const monthly = typeof body.goal_monthly_payment === "number" ? body.goal_monthly_payment : undefined;

    const existing = await env.DB.prepare(
      "SELECT goal_saved, goal_paid_off, goal_owed, goal_monthly_payment FROM user_goals WHERE id = 'default' LIMIT 1"
    ).first<{ goal_saved: number; goal_paid_off: number; goal_owed: number; goal_monthly_payment: number }>();

    const s = saved ?? existing?.goal_saved ?? 0;
    const p = paidOff ?? existing?.goal_paid_off ?? 6800;
    const o = owed ?? existing?.goal_owed ?? 4000;
    const m = monthly ?? existing?.goal_monthly_payment ?? 450;

    await env.DB.prepare(
      "REPLACE INTO user_goals (id, goal_saved, goal_paid_off, goal_owed, goal_monthly_payment, goal_target_label, updated_at) VALUES ('default', ?1, ?2, ?3, ?4, 'Cadillac CTS-V', unixepoch())"
    )
      .bind(s, p, o, m)
      .run();

    return json({ ok: true, goal: { goal_saved: s, goal_paid_off: p, goal_owed: o, goal_monthly_payment: m } });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

// --- Analytics (finance + AI/API spend) ---
async function apiAnalyticsFinance(env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ ok: false, error: "D1 not available" }, 503);
  const daysParam = url.searchParams.get("days");
  const allTime = daysParam === "all" || daysParam === "3650";
  const days = allTime ? 3650 : Math.min(Math.max(Number(daysParam) || 90, 7), 365);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  try {
    const [rowsResult, byMonthResult, byCategoryResult] = await Promise.all([
      allTime
        ? env.DB.prepare("SELECT id, date, amount, category, description, created_at FROM finance_entries ORDER BY date DESC LIMIT 500").all()
        : env.DB.prepare("SELECT id, date, amount, category, description, created_at FROM finance_entries WHERE date >= ? ORDER BY date DESC LIMIT 500").bind(cutoffStr).all(),
      allTime
        ? env.DB.prepare("SELECT strftime('%Y-%m', date) as month, SUM(amount) as total FROM finance_entries GROUP BY month ORDER BY month").all()
        : env.DB.prepare("SELECT strftime('%Y-%m', date) as month, SUM(amount) as total FROM finance_entries WHERE date >= ? GROUP BY month ORDER BY month").bind(cutoffStr).all(),
      allTime
        ? env.DB.prepare("SELECT category, SUM(amount) as total FROM finance_entries GROUP BY category ORDER BY total DESC").all()
        : env.DB.prepare("SELECT category, SUM(amount) as total FROM finance_entries WHERE date >= ? GROUP BY category ORDER BY total DESC").bind(cutoffStr).all(),
    ]);
    const rows = (rowsResult?.results ?? []) as { id: string; date: string; amount: unknown; category: string; description: string | null; created_at: number }[];
    const byMonthRaw = (byMonthResult?.results ?? []) as { month: string; total: unknown }[];
    const byCategoryRaw = (byCategoryResult?.results ?? []) as { category: string; total: unknown }[];
    const byMonth = byMonthRaw.map((m) => ({ month: m.month, total: Number(m.total) || 0 }));
    const byCategory = byCategoryRaw.map((c) => ({ category: c.category || "Uncategorized", total: Number(c.total) || 0 }));
    const total = rows.reduce((s, r) => s + Number(r.amount) || 0, 0);
    return json({
      ok: true,
      summary: { total, count: rows.length },
      byMonth,
      byCategory,
      rows: rows.map((r) => ({ ...r, amount: Number(r.amount) || 0 })),
    });
  } catch (e) {
    return json({
      ok: true,
      summary: { total: 0, count: 0 },
      byMonth: [],
      byCategory: [],
      rows: [],
      note: "Run migrations/0001_analytics_tables.sql on D1 to enable finance tracking.",
    });
  }
}

async function apiAnalyticsFinancePost(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ ok: false, error: "D1 not available" }, 503);
  const body = await request.json<{ date: string; amount: number; category: string; description?: string }>().catch(() => null);
  const date = body?.date ?? new Date().toISOString().slice(0, 10);
  const amount = Number(body?.amount);
  const category = String(body?.category ?? "").trim();
  const description = body?.description ?? null;
  if (!category || Number.isNaN(amount)) return json({ error: "date, amount, category required" }, 400);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO finance_entries (id, date, amount, category, description, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())"
    ).bind(id, date, amount, category, description).run();
    return json({ ok: true, id, date, amount, category });
  } catch (e) {
    return json({
      error: "Insert failed. Run migrations/0001_analytics_tables.sql on D1.",
      detail: String(e),
    }, 500);
  }
}

async function apiAnalyticsNeurons(env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ ok: false, error: "D1 not available" }, 503);
  const daysParam = url.searchParams.get("days");
  const allTime = daysParam === "all" || daysParam === "3650";
  const days = allTime ? 3650 : Math.min(Math.max(Number(daysParam) || 30, 7), 365);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const whereClause = allTime ? "" : " WHERE date >= ? ";
  try {
    const [rowsResult, byDayResult, byProviderResult, byAccountResult] = await Promise.all([
      allTime
        ? env.DB.prepare("SELECT id, date, provider, model, tokens_input, tokens_output, cost_estimate, endpoint, account, created_at FROM ai_usage_log ORDER BY created_at DESC LIMIT 500").all()
        : env.DB.prepare("SELECT id, date, provider, model, tokens_input, tokens_output, cost_estimate, endpoint, account, created_at FROM ai_usage_log WHERE date >= ? ORDER BY created_at DESC LIMIT 500").bind(cutoffStr).all(),
      allTime
        ? env.DB.prepare("SELECT date, SUM(cost_estimate) as cost, SUM(tokens_input + tokens_output) as tokens FROM ai_usage_log GROUP BY date ORDER BY date").all()
        : env.DB.prepare("SELECT date, SUM(cost_estimate) as cost, SUM(tokens_input + tokens_output) as tokens FROM ai_usage_log WHERE date >= ? GROUP BY date ORDER BY date").bind(cutoffStr).all(),
      allTime
        ? env.DB.prepare("SELECT provider, SUM(cost_estimate) as cost, SUM(tokens_input + tokens_output) as tokens FROM ai_usage_log GROUP BY provider ORDER BY cost DESC").all()
        : env.DB.prepare("SELECT provider, SUM(cost_estimate) as cost, SUM(tokens_input + tokens_output) as tokens FROM ai_usage_log WHERE date >= ? GROUP BY provider ORDER BY cost DESC").bind(cutoffStr).all(),
      allTime
        ? env.DB.prepare("SELECT COALESCE(account, '') as account, SUM(cost_estimate) as cost, SUM(tokens_input + tokens_output) as tokens FROM ai_usage_log GROUP BY account ORDER BY cost DESC").all()
        : env.DB.prepare("SELECT COALESCE(account, '') as account, SUM(cost_estimate) as cost, SUM(tokens_input + tokens_output) as tokens FROM ai_usage_log WHERE date >= ? GROUP BY account ORDER BY cost DESC").bind(cutoffStr).all(),
    ]);
    const rows = (rowsResult?.results ?? []) as { id: string; date: string; provider: string; model: string | null; tokens_input: unknown; tokens_output: unknown; cost_estimate: unknown; endpoint: string | null; account: string | null; created_at: number }[];
    const byDayRaw = (byDayResult?.results ?? []) as { date: string; cost: unknown; tokens: unknown }[];
    const byProviderRaw = (byProviderResult?.results ?? []) as { provider: string; cost: unknown; tokens: unknown }[];
    const byAccountRaw = (byAccountResult?.results ?? []) as { account: string; cost: unknown; tokens: unknown }[];
    const byDay = byDayRaw.map((d) => ({ date: d.date, cost: Number(d.cost) || 0, tokens: Number(d.tokens) || 0 }));
    const byProvider = byProviderRaw.map((p) => ({ provider: p.provider || "unknown", cost: Number(p.cost) || 0, tokens: Number(p.tokens) || 0 }));
    const byAccount = byAccountRaw.map((a) => ({ account: a.account || "(no account)", cost: Number(a.cost) || 0, tokens: Number(a.tokens) || 0 })).filter((a) => a.account !== "" || a.cost > 0);
    const totalCost = rows.reduce((s, r) => s + (Number(r.cost_estimate) || 0), 0);
    const totalTokens = rows.reduce((s, r) => s + (Number(r.tokens_input) || 0) + (Number(r.tokens_output) || 0), 0);
    return json({
      ok: true,
      summary: { totalCost, totalTokens, count: rows.length },
      byDay,
      byProvider,
      byAccount,
      rows,
    });
  } catch (e) {
    return json({
      ok: true,
      summary: { totalCost: 0, totalTokens: 0, count: 0 },
      byDay: [],
      byProvider: [],
      byAccount: [],
      rows: [],
      note: "Run migrations/0001_analytics_tables.sql on D1. AI usage is logged automatically from RAG and /api/ai/generate. Cursor and Gemini will appear when integrated.",
    });
  }
}

async function logAiUsage(env: Env, provider: string, model: string, tokensIn: number, tokensOut: number, endpoint: string, costEstimate?: number, account?: string | null): Promise<void> {
  if (!env.DB) return;
  const id = crypto.randomUUID();
  const date = new Date().toISOString().slice(0, 10);
  const cost = costEstimate ?? 0;
  try {
    await env.DB.prepare(
      "INSERT INTO ai_usage_log (id, date, provider, model, tokens_input, tokens_output, cost_estimate, endpoint, account, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())"
    ).bind(id, date, provider, model, tokensIn, tokensOut, cost, endpoint, account ?? null).run();
  } catch (_) {}
}

/** Cursor CSV row shape (from usage export) */
interface CursorUsageEvent {
  Date: string;
  Kind?: string;
  Model?: string;
  "Input (w/ Cache Write)"?: string;
  "Input (w/o Cache Write)"?: string;
  "Cache Read"?: string;
  "Output Tokens"?: string;
  "Total Tokens"?: string;
  Cost: string | number;
}

async function apiAnalyticsNeuronsImport(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ ok: false, error: "D1 not available" }, 503);
  const body = await request.json().catch(() => null) as { account: string; provider?: string; events: CursorUsageEvent[] } | null;
  const account = body?.account?.trim();
  const events = Array.isArray(body?.events) ? body.events : [];
  if (!account || events.length === 0) return json({ error: "account and events[] required" }, 400);
  const provider = (body?.provider ?? "Cursor").trim() || "Cursor";
  let inserted = 0;
  const stmt = env.DB.prepare(
    "INSERT INTO ai_usage_log (id, date, provider, model, tokens_input, tokens_output, cost_estimate, endpoint, account, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())"
  );
  for (const e of events) {
    const dateStr = typeof e.Date === "string" ? e.Date.slice(0, 10) : "";
    if (!dateStr) continue;
    const totalTokens = parseInt(String(e["Total Tokens"] ?? 0), 10) || 0;
    const outputTokens = parseInt(String(e["Output Tokens"] ?? 0), 10) || 0;
    const tokensInput = Math.max(0, totalTokens - outputTokens);
    const cost = parseFloat(String(e.Cost ?? 0)) || 0;
    const model = (e.Model ?? "auto").toString();
    const id = crypto.randomUUID();
    try {
      await stmt.bind(id, dateStr, provider, model, tokensInput, outputTokens, cost, "import", account).run();
      inserted++;
    } catch (_) {}
  }
  return json({ ok: true, inserted, total: events.length, account, provider });
}

// --- Cloudflare Images (list / get / delete / upload) ---
const CF_IMAGES_BASE = (accountId: string) => `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;

async function apiImagesList(env: Env, url: URL): Promise<Response> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_IMAGES_API_TOKEN;
  const hash = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;
  if (!accountId || !token) return json({ error: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_IMAGES_API_TOKEN required. Set vars + wrangler secret put CLOUDFLARE_IMAGES_API_TOKEN" }, 503);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const perPage = Math.min(10000, Math.max(10, Number(url.searchParams.get("per_page")) || 100));
  const res = await fetch(`${CF_IMAGES_BASE(accountId)}?page=${page}&per_page=${perPage}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { success?: boolean; result?: { images?: unknown[] }; errors?: unknown[] };
  if (!res.ok) return json({ error: "Cloudflare Images API error", status: res.status, cf: data }, res.status >= 500 ? 502 : res.status);
  const images = (data.result?.images ?? []).map((img: { id?: string; filename?: string; uploaded?: string; variants?: string[] }) => ({
    id: img.id,
    filename: img.filename,
    uploaded: img.uploaded,
    variants: img.variants,
    url: hash && img.id ? `https://imagedelivery.net/${hash}/${img.id}/public` : null,
    thumbnail: hash && img.id ? `https://imagedelivery.net/${hash}/${img.id}/thumbnail` : null,
  }));
  return json({ ok: true, images, accountHash: hash ?? undefined });
}

async function apiImagesGet(env: Env, imageId: string): Promise<Response> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_IMAGES_API_TOKEN;
  const hash = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;
  if (!accountId || !token) return json({ error: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_IMAGES_API_TOKEN required" }, 503);
  const id = decodeURIComponent(imageId);
  const res = await fetch(`${CF_IMAGES_BASE(accountId)}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { success?: boolean; result?: unknown; errors?: unknown[] };
  if (!res.ok) return json({ error: "Cloudflare Images API error", status: res.status, cf: data }, res.status >= 500 ? 502 : res.status);
  const img = data.result as { id?: string; filename?: string; uploaded?: string; variants?: string[] } | undefined;
  const out = img ? { ...img, url: hash && img.id ? `https://imagedelivery.net/${hash}/${img.id}/public` : null, thumbnail: hash && img.id ? `https://imagedelivery.net/${hash}/${img.id}/thumbnail` : null } : data.result;
  return json({ ok: true, image: out });
}

async function apiImagesDelete(env: Env, imageId: string): Promise<Response> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_IMAGES_API_TOKEN;
  if (!accountId || !token) return json({ error: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_IMAGES_API_TOKEN required" }, 503);
  const id = decodeURIComponent(imageId);
  const res = await fetch(`${CF_IMAGES_BASE(accountId)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { success?: boolean; errors?: unknown[] };
  if (!res.ok) return json({ error: "Cloudflare Images API error", status: res.status, cf: data }, res.status >= 500 ? 502 : res.status);
  return json({ ok: true, deleted: id });
}

async function apiImagesUpload(request: Request, env: Env): Promise<Response> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_IMAGES_API_TOKEN;
  const hash = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;
  if (!accountId || !token) return json({ error: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_IMAGES_API_TOKEN required" }, 503);
  const contentType = request.headers.get("Content-Type") ?? "";
  let body: BodyInit;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as { url?: string };
    if (!json?.url) return json({ error: "url required (or send multipart/form-data with file)" }, 400);
    body = JSON.stringify({ url: json.url });
    headers["Content-Type"] = "application/json";
  } else if (contentType.includes("multipart/form-data")) {
    body = await request.arrayBuffer();
    headers["Content-Type"] = contentType;
  } else {
    return json({ error: "Content-Type must be application/json (body: { url }) or multipart/form-data (file)" }, 400);
  }
  const res = await fetch(CF_IMAGES_BASE(accountId), {
    method: "POST",
    headers,
    body,
  });
  const data = (await res.json()) as { success?: boolean; result?: { id?: string; filename?: string; uploaded?: string; variants?: string[] }; errors?: unknown[] };
  if (!res.ok) return json({ error: "Cloudflare Images API error", status: res.status, cf: data }, res.status >= 500 ? 502 : res.status);
  const img = data.result as { id?: string; filename?: string; uploaded?: string; variants?: string[] } | undefined;
  const out = img ? { ...img, url: hash && img.id ? `https://imagedelivery.net/${hash}/${img.id}/public` : null, thumbnail: hash && img.id ? `https://imagedelivery.net/${hash}/${img.id}/thumbnail` : null } : data.result;
  return json({ ok: true, image: out });
}

// --- R2 ---
async function apiR2(request: Request, env: Env, subpath: string, method: string, url?: URL): Promise<Response> {
  if (!env.R2) return json({ error: "R2 binding not available" }, 503);
  const key = decodeURIComponent(subpath.replace(/\/$/, "") || "");
  if (!key && method !== "GET") return json({ error: "key required" }, 400);

  if (method === "GET") {
    if (!key) {
      const prefix = url?.searchParams.get("prefix") ?? undefined;
      const cursor = url?.searchParams.get("cursor") ?? undefined;
      const limit = Math.min(Number(url?.searchParams.get("limit")) || 1000, 1000);
      const list = await env.R2.list({ prefix, cursor, limit });
      return json({
        ok: true,
        objects: list.objects.map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded })),
        truncated: list.truncated,
        cursor: list.truncated ? list.cursor : undefined,
      });
    }
    const obj = await env.R2.get(key);
    if (!obj) return json({ error: "Not found" }, 404);
    return new Response(obj.body, {
      headers: { "Content-Type": (obj as R2ObjectBody).httpMetadata?.contentType ?? "application/octet-stream" },
    });
  }
  if (method === "PUT" && key) {
    const body = await request.arrayBuffer();
    await env.R2.put(key, body, {
      httpMetadata: request.headers.get("Content-Type") ? { contentType: request.headers.get("Content-Type")! } : undefined,
    });
    return json({ ok: true, key });
  }
  if (method === "DELETE" && key) {
    await env.R2.delete(key);
    return json({ ok: true, key });
  }
  return json({ error: "Method not allowed" }, 405);
}

// --- Workers AI ---
async function apiAIGenerate(request: Request, env: Env): Promise<Response> {
  if (!env.AI) return json({ error: "Workers AI binding not available" }, 503);
  const body = await request.json<{ prompt: string; system?: string }>().catch(() => null);
  const prompt = body?.prompt ?? "";
  const system = body?.system ?? "You are a helpful assistant.";
  if (!prompt) return json({ error: "prompt required" }, 400);
  const out = await env.AI.run(CHAT_MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    max_tokens: 1024,
  });
  const text = (out as { response?: string })?.response ?? String(out);
  const tokensIn = Math.ceil((prompt.length + (system?.length ?? 0)) / 4);
  const tokensOut = Math.ceil((text?.length ?? 0) / 4);
  const costEst = (tokensIn / 1e6) * 0.2 + (tokensOut / 1e6) * 0.2;
  await logAiUsage(env, "workers_ai", CHAT_MODEL, tokensIn, tokensOut, "ai/generate", costEst);
  return json({ ok: true, response: text });
}

// --- Vectorize ---
async function apiVectorizeQuery(request: Request, env: Env): Promise<Response> {
  if (!env.VECTORIZE) return json({ error: "Vectorize binding not available" }, 503);
  const body = await request.json<{ vector?: number[]; topK?: number }>().catch(() => null);
  const vector = body?.vector;
  const topK = Math.min(Number(body?.topK) || 5, 100);
  if (!vector?.length) return json({ error: "vector array required" }, 400);
  const matches = await env.VECTORIZE.query(vector, { topK });
  return json({ ok: true, matches });
}

async function apiVectorizeInsert(request: Request, env: Env): Promise<Response> {
  if (!env.VECTORIZE) return json({ error: "Vectorize binding not available" }, 503);
  if (!env.AI) return json({ error: "Workers AI required for embed" }, 503);
  const body = await request.json<{ id: string; text: string; metadata?: Record<string, string> }>().catch(() => null);
  const id = body?.id ?? crypto.randomUUID();
  const text = body?.text ?? "";
  if (!text) return json({ error: "text required" }, 400);
  const embed = await env.AI.run(EMBED_MODEL, { text: [text] });
  const values = (embed as { shape?: number[]; data?: number[][] })?.data?.[0] ?? (embed as number[]);
  if (!Array.isArray(values)) return json({ error: "embed failed" }, 500);
  const metadata: Record<string, string | number | boolean> = { text, ...(body?.metadata ?? {}) };
  await env.VECTORIZE.upsert([{ id, values, metadata }]);
  return json({ ok: true, id });
}

// --- AutoRAG: embed query -> Vectorize search -> Workers AI with context ---
async function apiRag(request: Request, env: Env): Promise<Response> {
  if (!env.AI || !env.VECTORIZE) return json({ error: "AI and Vectorize bindings required" }, 503);
  const body = await request.json<{ question: string; topK?: number }>().catch(() => null);
  const question = body?.question ?? "";
  const topK = Math.min(Number(body?.topK) || 5, 20);
  if (!question) return json({ error: "question required" }, 400);

  const embedOut = await env.AI.run(EMBED_MODEL, { text: [question] });
  const queryVector = (embedOut as { shape?: number[]; data?: number[][] })?.data?.[0] ?? (embedOut as number[]);
  if (!Array.isArray(queryVector)) return json({ error: "embed failed" }, 500);

  const matches = await env.VECTORIZE.query(queryVector, { topK });
  const context = matches.matches
    .map((m) => (typeof m.metadata?.text === "string" ? m.metadata.text : m.metadata ? JSON.stringify(m.metadata) : ""))
    .filter(Boolean)
    .join("\n\n");

  const system = `You are agent_sam, the MeauxIDE assistant. Answer using only the provided context when relevant. If the context does not contain the answer, say so briefly.`;
  const userContent = context
    ? `Context:\n${context}\n\nQuestion: ${question}`
    : `No retrieved context. Question: ${question}`;

  const out = await env.AI.run(CHAT_MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    max_tokens: 1024,
  });
  const response = (out as { response?: string })?.response ?? String(out);
  const tokensIn = Math.ceil((question.length + context.length) / 4);
  const tokensOut = Math.ceil((response?.length ?? 0) / 4);
  const costEst = (tokensIn / 1e6) * 0.2 + (tokensOut / 1e6) * 0.2;
  await logAiUsage(env, "workers_ai", CHAT_MODEL, tokensIn, tokensOut, "rag", costEst);
  return json({
    ok: true,
    response,
    retrieved: matches.matches.length,
    ids: matches.matches.map((m) => m.id),
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
