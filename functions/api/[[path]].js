export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // USUARIOS: Login
    if (url.pathname === "/api/check-user" && request.method === "GET") {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify(user ? { found: true, user } : { found: false }), { headers: corsHeaders });
    }

    // USUARIOS: Guardar/Editar/Ubicación
    if (url.pathname === "/api/user" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        INSERT OR REPLACE INTO users (id, name, phone, role, lat, lng, details, bio, last_seen) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(data.id, data.name, data.phone, data.role || 'Usuario', data.lat, data.lng, data.details || '', data.bio || '').run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // USUARIOS: Lista Activos (5 min)
    if (url.pathname === "/api/users" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users WHERE last_seen > datetime('now', '-5 minutes') ORDER BY last_seen DESC").all();
      return new Response(JSON.stringify(results || []), { headers: corsHeaders });
    }

    // CHAT: Enviar Mensaje
    if (url.pathname === "/api/send-message" && request.method === "POST") {
      const { from_id, to_id, text } = await request.json();
      await env.DB.prepare("INSERT INTO messages (from_id, to_id, text, created_at) VALUES (?, ?, ?, datetime('now'))")
        .bind(from_id, to_id, text).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // CHAT: Obtener Mensajes entre dos personas
    if (url.pathname === "/api/get-messages" && request.method === "GET") {
      const u1 = url.searchParams.get("u1");
      const u2 = url.searchParams.get("u2");
      const { results } = await env.DB.prepare(`
        SELECT * FROM messages 
        WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
        ORDER BY created_at ASC LIMIT 50
      `).bind(u1, u2, u2, u1).all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}