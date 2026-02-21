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
    // --- CHECK NOTIFICATIONS ---
    if (url.pathname === "/api/check-notifications" && request.method === "GET") {
      const userId = url.searchParams.get("user_id");
      const { results } = await env.DB.prepare(`
        SELECT m.*, u.name as sender_name FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.receiver_id = ? AND m.id > COALESCE((SELECT id FROM messages WHERE receiver_id = ? ORDER BY id DESC LIMIT 1 OFFSET 1), 0)
        ORDER BY m.created_at DESC LIMIT 1
      `).bind(userId, userId).all();
      
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // --- OBTENER MENSAJES ---
    if (url.pathname.startsWith("/api/messages/") && request.method === "GET") {
      const otherUserId = url.pathname.split("/").pop();
      const myId = url.searchParams.get("me");
      
      const { results } = await env.DB.prepare(`
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
      `).bind(myId, otherUserId, otherUserId, myId).all();
      
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // --- ENVIAR MENSAJE ---
    if (url.pathname === "/api/messages" && request.method === "POST") {
      const data = await request.json();
      
      // Al enviar mensaje, actualizamos el estado de AMBOS interlocutores a 'online'
      await env.DB.prepare(`UPDATE users SET status = 'online', last_seen = datetime('now') WHERE id = ? OR id = ?`)
        .bind(data.sender_id, data.receiver_id).run();

      // Guardar mensaje
      await env.DB.prepare(`
        INSERT INTO messages (sender_id, receiver_id, message, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(data.sender_id, data.receiver_id, data.message).run();
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- CHECK USER ---
    if (url.pathname === "/api/check-user" && request.method === "GET") {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify(user ? { found: true, user } : { found: false }), { headers: corsHeaders });
    }

    // --- GUARDAR O ACTUALIZAR USUARIO ---
    if (url.pathname === "/api/user" && request.method === "POST") {
      const data = await request.json();
      
      // Si es un registro nuevo, marcamos como online
      const isUpdate = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(data.id).first();
      
      let sql = `
        INSERT INTO users (id, name, surname, phone, role, lat, lng, details, bio, avatar_url, status, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', datetime('now'))
      `;
      
      // Valores a insertar
      const values = [
        data.id, data.name, data.surname, data.phone, data.role, data.lat, data.lng, 
        data.details, data.bio, data.avatar_url || "", 
        (isUpdate ? 'status' : 'online'), // Mantener estado si actualizamos
        (isUpdate ? 'last_seen' : 'datetime(\'now\')') // Mantener last_seen si actualizamos
      ];
      
      await env.DB.prepare(sql).bind(...values).run();
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- ACTUALIZAR PERFIL (Foto y Bio) ---
    if (url.pathname === "/api/update-profile" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?
      `).bind(data.bio, data.avatar_url, data.id).run();
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- LISTAR USUARIOS ---
    if (url.pathname === "/api/users" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 50").all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // --- GUARDAR RESEÑA ---
    if (url.pathname === "/api/review" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        INSERT INTO reviews (target_id, author_name, stars, comment, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(data.targetId, data.author, data.stars, data.comment).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- OBTENER RESEÑAS ---
    if (url.pathname.startsWith("/api/reviews/") && request.method === "GET") {
      const targetId = url.pathname.split("/").pop();
      const { results } = await env.DB.prepare("SELECT * FROM reviews WHERE target_id = ? ORDER BY created_at DESC").bind(targetId).all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};