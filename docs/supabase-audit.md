# Supabase Backend Hardening – 15 Minute Audit

Purpose:  
Quickly detect security and architecture risks in Supabase projects.

Typical use cases:

- auditing AI-generated backend
- reviewing Lovable / no-code Supabase projects
- debugging data access issues
- freelance backend hardening tasks

Goal: find **80% of issues in about 15 minutes**.

---

# Step 1 — Check RLS status (2 min)

Open the table list and check Row Level Security.

Questions:

- Is RLS enabled on all tables containing user data?
- Are any tables storing private data without RLS?

Example SQL:

    alter table orders enable row level security;

Red flag:

- RLS disabled on tables containing user data.

This means queries can potentially access **all rows**.

---

# Step 2 — Identify ownership model (2 min)

Scan table schemas and identify ownership columns.

Typical fields:

    user_id
    owner_id
    family_id
    student_id
    organization_id

Ask:

Who owns each row?

If ownership is unclear, permission rules will be fragile.

Red flag:

Tables storing user data but **no ownership column exists**.

---

# Step 3 — Inspect SELECT policies (2 min)

Look for policies such as:

    using (user_id = auth.uid())

Or relational ownership:

    exists (
      select 1
      from students s
      where s.id = attempts.student_id
      and s.family_id = current_user_family
    )

Ask:

Can a user ever see another user's data?

Red flags:

- using (true)
- missing SELECT policy
- policies that are overly complex

---

# Step 4 — Inspect INSERT and UPDATE policies (2 min)

Look for WITH CHECK.

Example:

    with check (user_id = auth.uid())

Reason:

Without WITH CHECK, a user could insert rows for another user.

For UPDATE operations verify both clauses exist:

    using (...)
    with check (...)

Red flag:

UPDATE policy without WITH CHECK.

---

# Step 5 — Review Edge functions (2 min)

Search the codebase for Supabase client creation.

Safe pattern:

    createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    })

This ensures:

- auth.uid() works
- RLS policies apply

Danger pattern:

    createClient(url, serviceRoleKey)

Ask:

Is this endpoint bypassing RLS?

---

# Step 6 — Review RPC functions (2 min)

Look for:

- ownership validation
- tenant boundary checks

Example:

    select *
    from attempts
    where student_id = p_student_id
    and user_owns_family(auth.uid(), family_id)

Ask:

Does the function verify ownership or assume it?

Red flag:

RPC returning rows without ownership validation.

---

# Step 7 — Check storage security (2 min)

Open Supabase Storage and review bucket policies.

Verify:

- public buckets used only for public assets
- user content stored in protected buckets

Example rule:

    owner = auth.uid()

Red flag:

User files stored in **public buckets**.

---

# Step 8 — Look for duplicated access logic (1 min)

Search code for patterns like:

    where user_id =

If permission logic is duplicated across endpoints:

Red flag:

Access control scattered across application code.

Better approach:

    RLS policies
    + helper database functions

Single source of truth.

---

# Quick Risk Scoring

Low risk:
RLS properly implemented.

Medium risk:
RLS inconsistent or incomplete.

High risk:
service_role bypass or missing ownership.

---

# Common Problems in AI-Generated Supabase Apps

Typical issues found during audits:

1. RLS disabled
2. service_role used everywhere
3. tables without ownership columns
4. public storage buckets for private data
5. duplicated permission logic in API code

These appear very frequently.

---

# Audit Summary Template

Example report for a client:

    Supabase Security Audit Summary

    Tables reviewed: 12
    RLS enabled: 9 / 12
    High risk issues: 2
    Medium risk issues: 3

    Key findings:
    - Orders table missing SELECT policy
    - Edge function bypassing RLS with service_role
    - Storage bucket "uploads" publicly readable

    Recommended actions:
    - Add ownership-based RLS policies
    - Replace service_role client with JWT-authenticated client
    - Restrict storage access with bucket policies

---

# Core Principle

Database enforces security.  
API orchestrates logic.  
Frontend never enforces access control.
