-- Recommendation feed now uses updated_at as the sampling freshness signal.
create index if not exists posts_recommendation_updated_idx
on public.posts (status, visibility, updated_at desc);
