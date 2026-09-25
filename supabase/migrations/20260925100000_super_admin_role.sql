-- SUPER_ADMIN manages facilities (stores) and their admin accounts.
-- Added in its own migration: a new enum value can't be used in the
-- transaction that adds it.
alter type public.user_role add value if not exists 'SUPER_ADMIN';
