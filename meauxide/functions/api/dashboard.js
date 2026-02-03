/**
 * GET /api/dashboard - Dashboard stats from D1 (agent_configs, agent_sessions, agent_commands)
 */
export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) {
    return Response.json({ error: "D1 binding not available" }, { status: 503 });
  }
  try {
    const [configs, sessions, commands] = await Promise.all([
      db.prepare("SELECT COUNT(*) as count FROM agent_configs WHERE status = 'active'").first(),
      db.prepare("SELECT COUNT(*) as count FROM agent_sessions WHERE status = 'active'").first(),
      db.prepare("SELECT COUNT(*) as count FROM agent_commands WHERE status = 'active'").first(),
    ]);
    return Response.json({
      ok: true,
      agent_configs: configs?.count ?? 0,
      active_sessions: sessions?.count ?? 0,
      agent_commands: commands?.count ?? 0,
      db: "connected",
    });
  } catch (e) {
    return Response.json({ error: e.message, db: "error" }, { status: 500 });
  }
}
