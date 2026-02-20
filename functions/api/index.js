export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Manejo de CORS para navegadores
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar que la DB esté vinculada (Binding 'DB')
    if (!env.DB) {
      return new Response(JSON.stringify({ error: "Falta el binding 'DB' en Cloudflare" }), { status: 500, headers: corsHeaders });
    }

    // --- RUTA: VERIFICAR USUARIO ---
    if (path.endsWith("/check-user") && request.method === "GET") {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify({ found: !!user, user }), { headers: corsHeaders });
    }

    // --- RUTA: GUARDAR USUARIO ---
    if (path.endsWith("/user") && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        INSERT INTO users (id, name, phone, role, lat, lng, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(phone) DO UPDATE SET lat=excluded.lat, lng=excluded.lng, details=excluded.details
      `).bind(data.id, data.name, data.phone, data.role, data.lat, data.lng, data.details).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- RUTA: LISTAR USUARIOS ---
    if (path.endsWith("/users") && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users").all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // --- RUTA: RESEÑAS ---
    if (path.includes("/reviews/") && request.method === "GET") {
      const targetId = path.split("/").pop();
      const { results } = await env.DB.prepare("SELECT * FROM reviews WHERE target_id = ?").bind(targetId).all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Ruta no encontrada: " + path }), { status: 404, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}