# Demo data

`demo_report_data.sql` fills `status_history` with about 3 months of realistic
activity (≈10 000 status changes) so the **Rapporter** page can be demonstrated.

- Only history is added, tagged `notes = 'DEMO'`. Red points' current status,
  users and photos are not changed. Existing accounts are used as the people
  doing the work.
- Built-in situations: growth over time, a peak week (4–5 weeks ago), a slow
  inventory week (~9 weeks ago), a LineFeeder on holiday (6–7 weeks ago), busy
  departments (Järn, Trädgård, Bygg), extra skräp in Trädgård, one point out of
  service for two weeks, and some Kundorder picked up late.
- Running it again replaces the previous demo data (the period always ends "now").

Remove everything with `remove_demo_report_data.sql`.

Run either script in Supabase → SQL Editor.
