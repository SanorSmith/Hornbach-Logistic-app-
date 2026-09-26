-- Deleting a photo that belongs to a pallet failed with "The pallet has already
-- been picked" (or "A pallet can only be marked as picked"): the foreign key
-- point_pallets.image_id (on delete set null) clears the link on the pallet
-- row, and that update went through the "picking only" guard as the signed-in
-- user. Letting the photo link be cleared on its own fixes it; nothing else
-- about a pallet can be changed that way. (Follow-up to
-- 20260926130000_extra_pallets.sql.)

create or replace function public.before_pallet_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The pallet's photo was deleted: only the link is cleared.
  if new.image_id is null and old.image_id is not null
     and (to_jsonb(new) - 'image_id') = (to_jsonb(old) - 'image_id') then
    return new;
  end if;

  if auth.uid() is not null then
    if old.picked_at is not null then
      raise exception 'The pallet has already been picked';
    end if;
    if new.picked_at is null
       or (to_jsonb(new) - 'picked_at' - 'picked_by' - 'picked_as_extra')
          is distinct from (to_jsonb(old) - 'picked_at' - 'picked_by' - 'picked_as_extra') then
      raise exception 'A pallet can only be marked as picked';
    end if;
  end if;

  if old.picked_at is null and new.picked_at is not null then
    perform 1 from public.red_points where id = new.point_id for update;
    if auth.uid() is not null then
      new.picked_at := now();
      new.picked_by := auth.uid();
    end if;
    new.picked_as_extra := public.open_pallet_count(new.point_id) > 1;
  end if;
  return new;
end;
$$;

revoke execute on function public.before_pallet_update() from public, anon, authenticated;
