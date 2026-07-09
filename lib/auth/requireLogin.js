import { supabase } from '@/lib/supabase/client';

const DEFAULT_LOGIN_MESSAGE = '請先登入，才能使用這個功能。';

export function buildLoginPath(nextPath = '/') {
  const safeNextPath = nextPath || '/';

  return `/login?next=${encodeURIComponent(safeNextPath)}`;
}

export function showLoginPrompt(message = DEFAULT_LOGIN_MESSAGE) {
  if (typeof window === 'undefined') {
    return;
  }

  window.alert(message);
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data?.user || null;
}

export async function requireLogin({
  router,
  nextPath,
  message = DEFAULT_LOGIN_MESSAGE,
  replace = false,
  silent = false,
} = {}) {
  const user = await getCurrentUser();

  if (user) {
    return user;
  }

  if (!silent) {
    showLoginPrompt(message);
  }

  if (router) {
    const targetPath = nextPath || router.asPath || '/';
    const loginPath = buildLoginPath(targetPath);

    if (replace) {
      router.replace(loginPath);
    } else {
      router.push(loginPath);
    }
  }

  return null;
}
