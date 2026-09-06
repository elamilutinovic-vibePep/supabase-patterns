import { createClient } from "@supabase/supabase-js";

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "TEST_A_EMAIL",
  "TEST_A_PASSWORD",
  "TEST_B_EMAIL",
  "TEST_B_PASSWORD",
];

for (const name of requiredEnv) {
  if (!process.env[name]) {
    throw new Error(`Missing environment variable: ${name}`);
  }
}

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

const createTestClient = () =>
  createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
};

const expectNoError = (error, step) => {
  if (error) throw new Error(`${step}: ${error.message}`);
};

const signIn = async (client, email, password) => {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  expectNoError(error, `Sign in failed for ${email}`);
  assert(data.user, `No authenticated user returned for ${email}`);

  return data.user;
};

async function main() {
  const clientA = createTestClient();
  const clientB = createTestClient();
  const marker = `rls-isolation-${Date.now()}`;

  const userA = await signIn(
    clientA,
    process.env.TEST_A_EMAIL,
    process.env.TEST_A_PASSWORD,
  );

  const userB = await signIn(
    clientB,
    process.env.TEST_B_EMAIL,
    process.env.TEST_B_PASSWORD,
  );

  assert(userA.id !== userB.id, "Test users must have different IDs");

  const { data: noteA, error: insertAError } = await clientA
    .from("notes")
    .insert({ title: `${marker}-A`, body: "Owned by user A" })
    .select("id,user_id,title")
    .single();

  expectNoError(insertAError, "User A could not insert own note");
  assert(noteA.user_id === userA.id, "Note A has the wrong owner");

  const { data: noteB, error: insertBError } = await clientB
    .from("notes")
    .insert({ title: `${marker}-B`, body: "Owned by user B" })
    .select("id,user_id,title")
    .single();

  expectNoError(insertBError, "User B could not insert own note");
  assert(noteB.user_id === userB.id, "Note B has the wrong owner");

  const testIds = [noteA.id, noteB.id];

  const { data: rowsForA, error: readAError } = await clientA
    .from("notes")
    .select("id,user_id,title")
    .in("id", testIds);

  expectNoError(readAError, "User A read failed");
  assert(rowsForA.length === 1, "User A must see exactly one test note");
  assert(rowsForA[0].id === noteA.id, "User A received user B's note");

  const { data: rowsForB, error: readBError } = await clientB
    .from("notes")
    .select("id,user_id,title")
    .in("id", testIds);

  expectNoError(readBError, "User B read failed");
  assert(rowsForB.length === 1, "User B must see exactly one test note");
  assert(rowsForB[0].id === noteB.id, "User B received user A's note");

  const { error: foreignInsertError } = await clientB
    .from("notes")
    .insert({
      user_id: userA.id,
      title: `${marker}-foreign-insert`,
      body: "This insert must be rejected",
    });

  assert(
    foreignInsertError,
    "User B was allowed to insert a note owned by user A",
  );

  const { error: ownershipTransferError } = await clientA
    .from("notes")
    .update({ user_id: userB.id })
    .eq("id", noteA.id);

  assert(
    ownershipTransferError,
    "User A was allowed to transfer note ownership to user B",
  );

  const { data: foreignUpdateRows, error: foreignUpdateError } = await clientB
    .from("notes")
    .update({ title: `${marker}-unauthorized-update` })
    .eq("id", noteA.id)
    .select("id");

  expectNoError(foreignUpdateError, "Cross-owner update request failed unexpectedly");
  assert(
    foreignUpdateRows.length === 0,
    "User B was allowed to update user A's note",
  );

  const { data: foreignDeleteRows, error: foreignDeleteError } = await clientB
    .from("notes")
    .delete()
    .eq("id", noteA.id)
    .select("id");

  expectNoError(foreignDeleteError, "Cross-owner delete request failed unexpectedly");
  assert(
    foreignDeleteRows.length === 0,
    "User B was allowed to delete user A's note",
  );

  const { error: cleanupAError } = await clientA
    .from("notes")
    .delete()
    .eq("id", noteA.id);

  const { error: cleanupBError } = await clientB
    .from("notes")
    .delete()
    .eq("id", noteB.id);

  expectNoError(cleanupAError, "Cleanup for user A failed");
  expectNoError(cleanupBError, "Cleanup for user B failed");

  console.log("PASS: owner-only RLS isolation verified for users A and B");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
