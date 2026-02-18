import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

const supabase = createClient(url, anon);

async function main() {
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;

  const { data, error } = await supabase.rpc("create_note", {
    p_title: "Hello RPC",
    p_body: "Inserted via function; still RLS-protected.",
  });

  if (error) throw error;
  console.log("RPC result:", data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
