-- Removes all demo report data created by demo_report_data.sql.
-- Only rows tagged notes = 'DEMO' are deleted; real history is untouched.
delete from public.status_history where notes = 'DEMO';
