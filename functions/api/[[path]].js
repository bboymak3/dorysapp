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
    // --- RUTA: LOGIN ---
    if (url.pathname === "/api/check-user" && request.method === "GET") {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify(user ? { found: true, user } : { found: false }), { headers: corsHeaders });
    }

    // --- RUTA: GUARDAR USUARIO / ACTUALIZAR ---
    if (url.pathname === "/api/user" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        INSERT INTO users (id, name, phone, role, lat, lng, details, bio, avatar_url, status, last_seen, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET 
          lat = excluded.lat, 
          lng = excluded.lng, 
          details = excluded.details,
          bio = excluded.bio,
          avatar_url = excluded.avatar_url,
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
        data.avatar_url || '',
        data.status || 'offline'
      ).run();
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- RUTA: LISTA USUARIOS (FILTRO INACTIVIDAD 1 MIN) ---
    if (url.pathname === "/api/users" && request.method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT * FROM users 
        WHERE last_seen > datetime('now', '-60 seconds') 
        ORDER BY last_seen DESC
      `).all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // --- RUTA: ACTUALIZAR PERFIL ---
    if (url.pathname === "/api/update-profile" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?").bind(data.bio, data.avatar_url, data.id).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- RUTA: CHECK NOTIFICATIONS (CORREGIDO) ---
    // Ahora filtra para no notificar si el mensaje fue enviado por mí mismo
    if (url.pathname === "/api/check-notifications" && request.method === "GET") {
      const userId = url.searchParams.get("user_id");
      const { results } = await env.DB.prepare(`
        SELECT m.*, u.name as sender_name FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.receiver_id = ? AND m.sender_id != ? 
        ORDER BY m.created_at DESC LIMIT 1
      `).bind(userId, userId).all();
      
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // --- CHAT ---
    if (url.pathname.startsWith("/api/messages/") && request.method === "GET") {
      const otherUserId = url.pathname.split("/").pop();
      const myId = url.searchParams.get("me");
      const { results } = await env.DB.prepare(`
        SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at ASC
      `).bind(myId, otherUserId, otherUserId, myId).all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }
    if (url.pathname === "/api/messages" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("INSERT INTO messages (sender_id, receiver_id, message, created_at) VALUES (?, ?, ?, datetime('now'))").bind(data.sender_id, data.receiver_id, data.message).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- RESEÑAS ---
    if (url.pathname === "/api/review" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("INSERT INTO reviews (target_id, author_name, stars, comment, created_at) VALUES (?, ?, ?, ?, datetime('now'))").bind(data.targetId, data.author, data.stars, data.comment).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
    if (url.pathname.startsWith("/api/reviews/") && request.method === "GET") {
      const targetId = url.pathname.split("/").pop();
      const { results } = await env.DB.prepare("SELECT * FROM reviews WHERE target_id = ? ORDER BY created_at DESC").bind(targetId).all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404 });

  } catch (err) {
    return new Response("Error: " + err.message, { status: 500, headers: corsHeaders });
  }
}