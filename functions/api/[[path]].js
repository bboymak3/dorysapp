export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // RUTA: LOGIN / VERIFICAR USUARIO
    if (url.pathname === "/api/check-user" && request.method === "GET") {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify(user ? { found: true, user } : { found: false }), { headers: corsHeaders });
    }

    // RUTA: GUARDAR/ACTUALIZAR USUARIO Y UBICACIÓN (Cada POST actualiza last_seen)
    if (url.pathname === "/api/user" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        INSERT INTO users (id, name, phone, role, lat, lng, details, bio, status, last_seen, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(phone) DO UPDATE SET 
          lat = excluded.lat, 
          lng = excluded.lng, 
          details = excluded.details,
          bio = excluded.bio,
          status = excluded.status,
          last_seen = datetime('now')
      `).bind(
        data.id, 
        data.name, 
        data.phone, 
        data.role, 
        data.lat, 
        data.lng, 
        data.details || '',
        data.bio || 'Sin biografía',
        data.status || 'online'
      ).run();
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // RUTA: OBTENER USUARIOS (FILTRO DE 1 MINUTO DE INACTIVIDAD)
    if (url.pathname === "/api/users" && request.method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT *, (strftime('%s', 'now') - strftime('%s', last_seen)) as idle_time 
        FROM users 
        WHERE last_seen > datetime('now', '-60 seconds') 
        ORDER BY last_seen DESC
      `).all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // RUTA: GUARDAR RESEÑA
    if (url.pathname === "/api/review" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("INSERT INTO reviews (target_id, author_name, stars, comment, created_at) VALUES (?, ?, ?, ?, datetime('now'))")
        .bind(data.targetId, data.author, data.stars, data.comment).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // RUTA: OBTENER RESEÑAS
    if (url.pathname.startsWith("/api/reviews/") && request.method === "GET") {
      const targetId = url.pathname.split("/").pop();
      const { results } = await env.DB.prepare("SELECT * FROM reviews WHERE target_id = ? ORDER BY created_at DESC").bind(targetId).all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    return new Response("Ruta no encontrada", { status: 404 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
