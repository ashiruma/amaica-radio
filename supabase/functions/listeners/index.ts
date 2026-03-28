import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  try {
    const res = await fetch("http://s40.myradiostream.com:23535/status-json.xsl");
    const data = await res.json();

    let listeners = 0;

    if (Array.isArray(data.icestats.source)) {
      listeners = data.icestats.source[0].listeners;
    } else {
      listeners = data.icestats.source.listeners;
    }

    // 🔥 LOG TO SUPABASE
    await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/listeners_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
      },
      body: JSON.stringify({ count: listeners })
    });

    return new Response(JSON.stringify({ listeners }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});