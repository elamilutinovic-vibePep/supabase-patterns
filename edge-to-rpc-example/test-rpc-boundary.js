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
  const anonymousClient = createTestClient();
  const clientA = createTestClient();
  const clientB = createTestClient();
  const marker = `rpc-boundary-${Date.now()}`;

  const { error: anonymousError } = await anonymousClient.rpc(
    "create_contact_message",
    {
      p_name: "Anonymous User",
      p_email: "anonymous@example.com",
      p_message: marker,
    },
  );

  assert(
    anonymousError,
    "Anonymous caller was allowed to execute create_contact_message",
  );

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

  const { data: createdRows, error: validRpcError } = await clientA.rpc(
    "create_contact_message",
    {
      p_name: "User A",
      p_email: "USER.A@EXAMPLE.COM",
      p_message: marker,
    },
  );

  expectNoError(validRpcError, "Authenticated RPC call failed");
  assert(createdRows.length === 1, "RPC must return one created row");

  const created = createdRows[0];

  assert(created.user_id === userA.id, "Created message has the wrong owner");
  assert(
    created.email === "user.a@example.com",
    "RPC did not normalize the email",
  );

  const { error: invalidEmailError } = await clientA.rpc(
    "create_contact_message",
    {
      p_name: "User A",
      p_email: "abcde",
      p_message: `${marker}-invalid-email`,
    },
  );

  assert(invalidEmailError, "RPC accepted an invalid email");
  assert(
    invalidEmailError.code === "22023",
    `Expected error code 22023, received ${invalidEmailError.code}`,
  );

  const { data: rowsForB, error: readBError } = await clientB
    .from("contact_messages")
    .select("id,user_id,email,message")
    .eq("id", created.id);

  expectNoError(readBError, "User B read request failed");
  assert(
    rowsForB.length === 0,
    "User B received user A's contact message",
  );

  console.log(
    "PASS: RPC access, validation, normalization, and RLS isolation verified",
  );
  console.log(
    "Note: the successful test row remains in the disposable test project.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
