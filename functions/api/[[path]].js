export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // CHECK USER
    if (url.pathname === "/api/check-user" && request.method === "GET") {
      const phone = url.searchParams.get("phone");
      const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      return new Response(JSON.stringify(user ? { found: true, user } : { found: false }), { headers: corsHeaders });
    }

    // SAVE USER
    if (url.pathname === "/api/user" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("INSERT OR REPLACE INTO users (id, name, phone, role, lat, lng, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))")
        .bind(data.id, data.name, data.phone, data.role, data.lat, data.lng, data.details).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // GET USERS
    if (url.pathname === "/api/users" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 50").all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    // SAVE REVIEW
    if (url.pathname === "/api/review" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("INSERT INTO reviews (target_id, author_name, stars, comment, created_at) VALUES (?, ?, ?, ?, datetime('now'))")
        .bind(data.targetId, data.author, data.stars, data.comment).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // GET REVIEWS
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
