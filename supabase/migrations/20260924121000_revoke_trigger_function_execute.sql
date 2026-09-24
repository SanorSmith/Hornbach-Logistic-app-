-- Trigger functions must not be callable through the REST API (/rest/v1/rpc/...).
-- Triggers still fire: PostgreSQL does not check EXECUTE when firing a trigger.
revoke execute on function public.guard_user_changes() from public, anon, authenticated;
revoke execute on function public.log_status_change() from public, anon, authenticated;
revoke execute on function public.notify_kundorder() from public, anon, authenticated;
revoke execute on function public.update_last_updated_column() from public, anon, authenticated;
