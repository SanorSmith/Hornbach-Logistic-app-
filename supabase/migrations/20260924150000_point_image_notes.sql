-- Optional note saved together with each point photo ("Noteringar").
alter table public.point_images
  add column note text check (note is null or char_length(note) <= 1000);
