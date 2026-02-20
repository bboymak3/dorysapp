export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
    };

    // --- RUTA DE PRUEBA (RAÍZ) ---
    // Si entras a dorysapp...workers.dev sin nada, debe decir "HOLA"
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("HOLA - EL CODIGO NUEVO FUNCIONA", { headers: corsHeaders });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // RUTA: VERIFICAR USUARIO
      if (url.pathname === "/api/check-user" && request.method === "GET") {
        const phone = url.searchParams.get("phone");
        const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?")
          .bind(phone)
          .first();
        
        if (user) {
            return new Response(JSON.stringify({ found: true, user: user }), { headers: corsHeaders });
        } else {
            return new Response(JSON.stringify({ found: false }), { headers: corsHeaders });
        }
      }

      // RUTA: GUARDAR USUARIO
      if (url.pathname === "/api/user" && request.method === "POST") {
        const data = await request.json();
        const stmt = env.DB.prepare(`
          INSERT OR REPLACE INTO users (id, name, phone, role, lat, lng, details, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);
        await stmt.bind(data.id, data.name, data.phone, data.role, data.lat, data.lng, data.details).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // RUTA: LISTAR USUARIOS
      if (url.pathname === "/api/users" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 50").all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // RUTA: RESEÑAS
      if (url.pathname === "/api/review" && request.method === "POST") {
        const data = await request.json();
        await env.DB.prepare("INSERT INTO reviews (target_id, author_name, stars, comment, created_at) VALUES (?, ?, ?, ?, datetime('now'))")
          .bind(data.targetId, data.author, data.stars, data.comment).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (url.pathname.startsWith("/api/reviews/") && request.method === "GET") {
        const targetId = url.pathname.split("/").pop();
        const { results } = await env.DB.prepare("SELECT * FROM reviews WHERE target_id = ? ORDER BY created_at DESC")
          .bind(targetId).all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      return new Response("Ruta no encontrada en el Worker (v2)", { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response("Error del Servidor: " + err.message, { status: 500, headers: corsHeaders });
    }
  },
};