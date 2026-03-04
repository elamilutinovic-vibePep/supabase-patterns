# Supabase Security Checklist

**Purpose**: Quick review checklist for Supabase projects (auth, RLS, Edge functions, RPC).

Use when:

- auditing a project
- reviewing PR
- debugging data access issues
- hardening AI-generated backend

## 1. Is RLS enabled on all user-facing tables?

SQL:
    alter table ... enable row level security;

Check:

- tables storing user data
- session tables
- content tied to user/family/student

⚠ If RLS is disabled, assume data isolation is broken.

## 2. Does every table have a clear ownership model?

Typical ownership columns:

    user_id
    family_id
    student_id
    organization_id

Questions:

- Who owns the row?
- How does DB know the owner?

If ownership is unclear → policies become fragile.

## 3. Are SELECT policies present?

Minimal pattern:

    SQL:
        using (user_id = auth.uid())

Or relational ownership:

    SQL:
        exists (
        select 1
        from students s
        where s.id = attempts.student_id
        and user_owns_family(auth.uid(), s.family_id)
        )

⚠ No SELECT policy → table effectively unreadable or globally readable depending on setup.

## 4. Are INSERT policies using WITH CHECK?

Example:

    SQL:
        with check (user_id = auth.uid())

Reason:

Without WITH CHECK, user could insert rows for another user.

## 5. Are UPDATE policies using both USING and WITH CHECK?

Pattern:

    SQL:
        using (user_id = auth.uid())
        with check (user_id = auth.uid())

Meaning:

- USING → which rows user can update
- WITH CHECK → what values they are allowed to write

Without WITH CHECK, ownership could be changed.

## 6. Do Edge functions pass user JWT when needed?

Correct client creation for user context:

    SQL:
        createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } }
        })

This ensures:

    auth.uid() works
    RLS works

⚠ Missing JWT → auth.uid() becomes NULL → policies fail.

## 7. Are any endpoints using service_role?

If yes, verify:

- Why is RLS bypass needed?
- Is ownership validated manually?

Acceptable uses:

- admin tools
- scheduled jobs
- maintenance scripts

Risky uses:

- user data endpoints
- generic API routes

## 8. If service_role is used, is ownership check enforced?

Example pattern:

    SQL:
        user_owns_family(auth.uid(), student_family_id)

Or explicit join:

    SQL:
        exists (
        select 1
        from students
        where students.id = p_student_id
        and students.family_id = current_user_family
        )

⚠ Ownership checks should preferably live in DB functions.

## 9. Are storage buckets protected?

Check bucket policies:

- public buckets only for assets
- private buckets for user content

Example:

    SQL:
        (bucket_id = 'avatars' AND owner = auth.uid())

⚠ Public bucket + user uploads → common data leak.

## 10. Is there a single source of truth for permissions?

Permissions should live primarily in:

    RLS policies
    + helper DB functions

Avoid duplicating permission logic in:

- frontend
- Edge code
- multiple RPC functions

Rule:

    database enforces access
    API orchestrates logic

## Quick Red Flags

Immediate investigation needed if you see:

- service_role used in user endpoints
- tables without ownership column
- missing WITH CHECK
- RLS disabled
- storage buckets public by default
- policies using true

## Guiding Principle

    Data access should be enforced by the database,
    not trusted to application code.

RLS exists to prevent mistakes when systems grow.
