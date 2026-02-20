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
    // --- CHAT ---
    // Obtener mensajes entre yo y otro usuario
    if (url.pathname.startsWith("/api/messages/") && request.method === "GET") {
      const otherUserId = url.pathname.split("/").pop();
      // Se asume que el ID del usuario que envía está en el cuerpo o query, 
      // pero para simplificar en esta versión, el frontend enviará sender_id y receiver_id en el POST.
      // Para el GET, necesitamos saber QUIEN soy yo. En una app real vendría de una sesión (JWT).
      // AQUÍ USAREMOS UN PARÁMETRO 'me' EN LA URL POR SIMPLICIDAD.
      const myId = url.searchParams.get("me");
      
      const { results } = await env.DB.prepare(`
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
      `).bind(myId, otherUserId, otherUserId, myId).all();
      
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // Enviar mensaje
    if (url.pathname === "/api/messages" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        INSERT INTO messages (sender_id, receiver_id, message, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(data.sender_id, data.receiver_id, data.message).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- USUARIOS ---
    if (url.pathname === "/api/check-user" && request.method === "GET") {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify(user ? { found: true, user } : { found: false }), { headers: corsHeaders });
    }

    if (url.pathname === "/api/user" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("INSERT OR REPLACE INTO users (id, name, phone, role, lat, lng, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))")
        .bind(data.id, data.name, data.phone, data.role, data.lat, data.lng, data.details).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (url.pathname === "/api/users" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 50").all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // --- RESEÑAS ---
    if (url.pathname === "/api/review" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("INSERT INTO reviews (target_id, author_name, stars, comment, created_at) VALUES (?, ?, ?, ?, datetime('now'))")
        .bind(data.targetId, data.author, data.stars, data.comment).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (url.pathname.startsWith("/api/reviews/") && request.method === "GET") {
      const targetId = url.pathname.split("/").pop();
      const { results } = await env.DB.prepare("SELECT * FROM reviews WHERE target_id = ? ORDER BY created_at DESC").bind(targetId).all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404 });

  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
}