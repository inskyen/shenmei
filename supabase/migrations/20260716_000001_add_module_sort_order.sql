alter table public.modules
  add column if not exists sort_order integer not null default 1000;

comment on column public.modules.sort_order
  is '頻道展示順序；數字越小越靠前';

with ranked_modules as (
  select
    id,
    row_number() over (order by created_at desc, id) * 100 as generated_sort_order
  from public.modules
)
update public.modules as modules
set
  sort_order = ranked_modules.generated_sort_order,
  updated_at = now()
from ranked_modules
where modules.id = ranked_modules.id
  and modules.sort_order = 1000;

create index if not exists modules_status_sort_order_idx
  on public.modules (status, sort_order, created_at desc);
