import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  try {
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/listeners_log?select=*&order=created_at.desc&limit=50`,
      {
        headers: {
          "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        }
      }
    );

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});