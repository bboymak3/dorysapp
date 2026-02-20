export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Si no hay DB, avisar directamente
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "No hay conexión con DB. Revisa el Binding." }), { status: 500, headers: corsHeaders });
  }

  try {
    // RUTA: VERIFICAR USUARIO
    if (url.pathname.includes("check-user")) {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify({ found: !!user, user }), { headers: corsHeaders });
    }

    // RUTA: GUARDAR USUARIO
    if (url.pathname.includes("user") && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("INSERT INTO users (id, name, phone, role, lat, lng, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(phone) DO UPDATE SET lat=excluded.lat, lng=excluded.lng, details=excluded.details")
        .bind(data.id, data.name, data.phone, data.role, data.lat, data.lng, data.details).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // RUTA: LISTAR USUARIOS
    if (url.pathname.includes("users")) {
      const { results } = await env.DB.prepare("SELECT * FROM users").all();
      return new Response(JSON.stringify(results || []), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Ruta desconocida: " + url.pathname }), { status: 404, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}