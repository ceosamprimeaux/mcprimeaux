/**
 * GET /api/projects - List agent configs as "projects" from D1
 */
export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) {
    return Response.json({ error: "D1 binding not available" }, { status: 503 });
  }
  try {
    const stmt = db.prepare(
      "SELECT id, name, slug, description, config_type, status, version, updated_at FROM agent_configs ORDER BY updated_at DESC LIMIT 50"
    );
    const { results } = await stmt.all();
    return Response.json({ ok: true, rows: results ?? [] });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
