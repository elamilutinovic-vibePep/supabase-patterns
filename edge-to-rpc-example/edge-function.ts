// supabase/functions/contact_submit/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Payload = { name: string; email: string; message: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

  const token = authHeader.slice("Bearer ".length);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const name = (payload.name ?? "").trim();
  const email = (payload.email ?? "").trim().toLowerCase();
  const message = (payload.message ?? "").trim();

  // Minimal validation (keep it short here; DB also validates)
  if (name.length < 2) return json({ error: "Name too short" }, 400);
  if (!email.includes("@")) return json({ error: "Invalid email" }, 400);
  if (message.length < 5) return json({ error: "Message too short" }, 400);

  // IMPORTANT:
  // Use the anon key, BUT pass the user JWT in global headers.
  // That makes the DB see the call as the user (RLS applies).
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await supabase.rpc("create_contact_message", {
    p_name: name,
    p_email: email,
    p_message: message,
  });

  if (error) return json({ error: error.message }, 400);

  return json({ ok: true, data });
});
