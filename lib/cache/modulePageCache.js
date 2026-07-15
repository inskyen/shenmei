import { supabase } from '@/lib/supabase/client';

let modulesCache = null;
const modulePageCache = new Map();
const modulePageRequestCache = new Map();

export function getCachedModules() {
  return modulesCache;
}

export function getCachedModulePage(slug) {
  return modulePageCache.get(slug) || null;
}

export function cacheModules(modules) {
  modulesCache = modules || [];
}

export function cacheModulePage(module, posts, profilesById) {
  if (!module?.slug) return;

  modulePageCache.set(module.slug, {
    module,
    posts: posts || [],
    profilesById: profilesById || {},
  });
}

export async function prefetchModules({ force = false } = {}) {
  if (!force && modulesCache) return modulesCache;

  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, name, description, rule_text, cover_url, theme_color, sort_order, created_at')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;

  const modules = data || [];

  // Fetch the latest video cover for each module to use as card background
  if (modules.length > 0) {
    const moduleIds = modules.map((m) => m.id);

    const { data: coverRows } = await supabase
      .from('post_modules')
      .select(`
        module_id,
        posts (
          created_at,
          videos ( cover_url )
        )
      `)
      .in('module_id', moduleIds);

    // Build a map: moduleId -> latest cover_url
    const latestCoverByModuleId = {};
    for (const row of coverRows || []) {
      const cover = row.posts?.videos?.cover_url;
      if (!cover) continue;
      const existing = latestCoverByModuleId[row.module_id];
      if (!existing || new Date(row.posts.created_at) > new Date(existing.created_at)) {
        latestCoverByModuleId[row.module_id] = {
          cover_url: cover,
          created_at: row.posts.created_at,
        };
      }
    }

    // Attach latest_cover_url to each module
    for (const mod of modules) {
      mod.latest_cover_url = latestCoverByModuleId[mod.id]?.cover_url || null;
    }
  }

  cacheModules(modules);
  return modules;
}


export async function prefetchModulePage(slug, { force = false } = {}) {
  if (!slug) return null;

  const cached = getCachedModulePage(slug);
  if (!force && cached) return cached;

  // 列表页的后台预取和详情页可能几乎同时发生；复用同一个请求，避免重复等待。
  const pendingRequest = modulePageRequestCache.get(slug);
  if (pendingRequest) return pendingRequest;

  const request = (async () => {
    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id, slug, name, description, rule_text, status')
      .eq('slug', slug)
      .single();

    if (moduleError) throw moduleError;

    const { data: rows, error: rowsError } = await supabase
      .from('post_modules')
      .select(`
        posts (
          id,
          user_id,
          legacy_added_by,
          note,
          created_at,
          like_count,
          comment_count,
          videos (
            id,
            external_id,
            title,
            cover_url
          )
        )
      `)
      .eq('module_id', module.id);

    if (rowsError) throw rowsError;

    const posts = (rows || [])
      .map((row) => row.posts)
      .filter(Boolean)
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
    const profileIds = [...new Set(posts.map((post) => post.user_id).filter(Boolean))];
    let profilesById = {};

    if (profileIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', profileIds);

      if (profilesError) throw profilesError;

      profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
    }

    cacheModulePage(module, posts, profilesById);
    return getCachedModulePage(slug);
  })();

  modulePageRequestCache.set(slug, request);

  try {
    return await request;
  } finally {
    modulePageRequestCache.delete(slug);
  }
}
