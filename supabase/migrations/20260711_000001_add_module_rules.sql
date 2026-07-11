alter table public.modules
  add column if not exists rule_text text not null default '',
  add column if not exists rule_config jsonb not null default '{}'::jsonb;

alter table public.videos
  add column if not exists published_at timestamptz;

create unique index if not exists post_modules_one_module_per_post_idx
  on public.post_modules (post_id);
