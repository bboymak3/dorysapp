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