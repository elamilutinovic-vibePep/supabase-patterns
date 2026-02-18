import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

// Create a test user in Supabase Dashboard first
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

const supabase = createClient(url, anon);

async function main() {
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw signInErr;

  // Insert a row (user_id defaults to auth.uid())
  const { data: ins, error: insErr } = await supabase
    .from("notes")
    .insert({ title: "Hello RLS", body: "owner-only row" })
    .select()
    .single();
  if (insErr) throw insErr;

  // Read own rows
  const { data: rows, error: selErr } = await supabase
    .from("notes")
    .select("id,title,user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  if (selErr) throw selErr;

  console.log("Inserted:", ins);
  console.log("Latest rows:", rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
