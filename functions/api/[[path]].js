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
    // LOGIN
    if (url.pathname === "/api/check-user" && request.method === "GET") {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify(user ? { found: true, user } : { found: false }), { headers: corsHeaders });
    }

    // GUARDAR USUARIO Y UBICACIÓN
    if (url.pathname === "/api/user" && request.method === "POST") {
      const data = await request.json();
      // Usamos CURRENT_TIMESTAMP para asegurar consistencia
      await env.DB.prepare(`
        INSERT INTO users (id, name, phone, role, lat, lng, details, last_seen) 
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(phone) DO UPDATE SET 
          lat = excluded.lat, 
          lng = excluded.lng, 
          details = excluded.details,
          last_seen = CURRENT_TIMESTAMP
      `).bind(data.id, data.name, data.phone, data.role, data.lat, data.lng, data.details || '').run();
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // OBTENER USUARIOS (AUTO-LIMPIEZA: 1 MINUTO)
    if (url.pathname === "/api/users" && request.method === "GET") {
      // Filtramos usuarios que no se han reportado en los últimos 60 segundos
      const { results } = await env.DB.prepare(`
        SELECT * FROM users 
        WHERE last_seen > datetime('now', '-60 seconds')
      `).all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}