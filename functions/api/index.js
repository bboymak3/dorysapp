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

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar si la base de datos está vinculada
    if (!env.DB) {
      return new Response(JSON.stringify({ error: "Falta configurar el Binding DB" }), { status: 500, headers: corsHeaders });
    }

    // RUTA: VERIFICAR USUARIO
    if (path.includes("/check-user")) {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify({ found: !!user, user }), { headers: corsHeaders });
    }

    // RUTA: GUARDAR USUARIO
    if (path.includes("/user") && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("INSERT INTO users (id, name, phone, role, lat, lng, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(phone) DO UPDATE SET lat=excluded.lat, lng=excluded.lng, details=excluded.details")
        .bind(data.id, data.name, data.phone, data.role, data.lat, data.lng, data.details).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // RUTA: LISTAR USUARIOS
    if (path.includes("/users")) {
      const { results } = await env.DB.prepare("SELECT * FROM users").all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Ruta no encontrada" }), { status: 404, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
} 
