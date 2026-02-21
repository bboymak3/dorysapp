export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
      // --- RUTA: GUARDAR USUARIO (Con datos ampliados) ---
    if (url.pathname === "/api/user" && request.method === "POST") {
      const data = await request.json();
      
      // Si viene con foto o bio, actualizamos esos campos específicos
      let sql = `
        INSERT OR REPLACE INTO users (id, name, phone, role, lat, lng, details, bio, avatar_url, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      // Valores a insertar
      const values = [
        data.id, 
        data.name, 
        data.phone, 
        data.role, 
        data.lat, 
        data.lng, 
        data.details,
        data.bio || "",         // Si no manda bio, manda vacío
        data.avatar_url || "",  // Si no manda foto, manda vacío
        data.status || "offline" // Por defecto offline si no especifica
      ];
      
      await env.DB.prepare(sql).bind(...values).run();
      
      // Si es un UPDATE (el usuario ya existe) y el status es 'online', podemos hacer algo extra si quisiéramos
      // pero el INSERT OR REPLACE ya maneja la actualización.
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- NUEVA RUTA: ACTUALIZAR MI PERFIL (Solo para mí) ---
    // Esto permite cambiar mi foto y bio sin recargar la pagina
    if (url.pathname === "/api/update-profile" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?
      `).bind(data.bio, data.avatar_url, data.id).run();
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
  // Headers de seguridad (CORS)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- RUTA: CHECK NOTIFICATIONS (Para alertas en tiempo real) ---
    if (url.pathname === "/api/check-notifications" && request.method === "GET") {
      const userId = url.searchParams.get("user_id");
      // Buscamos el último mensaje donde YO soy el receptor
      // Hacemos un JOIN con la tabla users para obtener también el nombre del que envía
      const { results } = await env.DB.prepare(`
        SELECT m.*, u.name as sender_name FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.receiver_id = ? 
        ORDER BY m.created_at DESC LIMIT 1
      `).bind(userId).all();
      
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // --- RUTA: OBTENER MENSAJES DEL CHAT ---
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

    // --- RUTA: ENVIAR MENSAJE ---
    if (url.pathname === "/api/messages" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        INSERT INTO messages (sender_id, receiver_id, message, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(data.sender_id, data.receiver_id, data.message).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- RUTA: CHECK USER (Login) ---
    if (url.pathname === "/api/check-user" && request.method === "GET") {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify(user ? { found: true, user } : { found: false }), { headers: corsHeaders });
    }

    // --- RUTA: GUARDAR USUARIO (Registro / Update) ---
    if (url.pathname === "/api/user" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        INSERT OR REPLACE INTO users (id, name, phone, role, lat, lng, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(data.id, data.name, data.phone, data.role, data.lat, data.lng, data.details).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- RUTA: LISTAR USUARIOS ---
    if (url.pathname === "/api/users" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 50").all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // --- RUTA: GUARDAR RESEÑA ---
    if (url.pathname === "/api/review" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare(`
        INSERT INTO reviews (target_id, author_name, stars, comment, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(data.targetId, data.author, data.stars, data.comment).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- RUTA: OBTENER RESEÑAS ---
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