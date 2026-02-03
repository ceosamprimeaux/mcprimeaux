/**
 * GET /api/health - D1 connectivity check
 */
export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) {
    return Response.json({ ok: false, db: "no binding" }, { status: 503 });
  }
  try {
    const row = await db.prepare("SELECT 1 as ping").first();
    return Response.json({ ok: true, db: "connected", ping: row?.ping ?? 1 });
  } catch (e) {
    return Response.json({ ok: false, db: "error", error: e.message }, { status: 500 });
  }
}
