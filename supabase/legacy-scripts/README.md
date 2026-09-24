# Legacy scripts - DO NOT RUN

These one-off scripts disabled Row Level Security or opened tables to the
`anon` role while the app had no login. They are superseded by
`supabase/migrations/20260924120000_role_based_rls.sql`.

Running any of them again would re-expose the database to anyone with the
public anon key. They are kept only for history.
