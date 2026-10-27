-- =============================================================================
-- Admin users
-- Profil dan otorisasi admin. Kredensial tetap dikelola Supabase Auth
-- (auth.users); tabel ini tidak menyimpan password.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users("isActive");

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages admin users" ON public.admin_users;
CREATE POLICY "Service role manages admin users"
    ON public.admin_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

REVOKE ALL ON public.admin_users FROM anon, authenticated;
GRANT ALL ON public.admin_users TO service_role;

-- Backfill akun admin yang sudah ada di Supabase Auth.
INSERT INTO public.admin_users (id, email, name, role, "createdAt", "updatedAt")
SELECT
    u.id,
    u.email,
    COALESCE(
        u.raw_user_meta_data->>'name',
        u.raw_user_meta_data->>'full_name',
        split_part(u.email, '@', 1)
    ),
    CASE
        WHEN u.raw_app_meta_data->>'role' = 'superadmin' THEN 'superadmin'
        ELSE 'admin'
    END,
    COALESCE(u.created_at, now()),
    now()
FROM auth.users u
WHERE u.email IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'role', '') IN ('admin', 'superadmin')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    "updatedAt" = now();
