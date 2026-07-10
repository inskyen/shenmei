import { supabase } from '@/lib/supabase/client';

const DEFAULT_LOGIN_MESSAGE = '請先登入，才能使用這個功能。';

export function buildLoginPath(nextPath = '/') {
  const safeNextPath = nextPath || '/';

  return `/login?next=${encodeURIComponent(safeNextPath)}`;
}

export function showLoginPrompt(message = DEFAULT_LOGIN_MESSAGE) {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    // 建立全螢幕毛玻璃遮罩
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(42, 63, 84, 0.45)';
    overlay.style.backdropFilter = 'blur(12px)';
    overlay.style.WebkitBackdropFilter = 'blur(12px)'; // Safari support
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '999999';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)';

    // 建立彈窗容器
    const modal = document.createElement('div');
    modal.style.backgroundColor = '#FFFFFF';
    modal.style.backgroundImage = 'linear-gradient(135deg, rgba(244, 247, 250, 0.6) 0%, rgba(255, 255, 255, 1) 100%)';
    modal.style.border = '1px solid rgba(255, 255, 255, 0.9)';
    modal.style.borderRadius = '24px';
    modal.style.boxShadow = '0 24px 60px rgba(42, 63, 84, 0.15)';
    modal.style.padding = '32px 24px';
    modal.style.width = '85%';
    modal.style.maxWidth = '340px';
    modal.style.textAlign = 'center';
    modal.style.transform = 'scale(0.9) translateY(20px)';
    modal.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    modal.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    // 頂部圖示 (冰藍色漸層圓形)
    const iconContainer = document.createElement('div');
    iconContainer.style.width = '64px';
    iconContainer.style.height = '64px';
    iconContainer.style.borderRadius = '50%';
    iconContainer.style.background = 'linear-gradient(135deg, #E6EEF8 0%, #D4E5F7 100%)';
    iconContainer.style.display = 'flex';
    iconContainer.style.alignItems = 'center';
    iconContainer.style.justifyContent = 'center';
    iconContainer.style.margin = '0 auto 20px';
    iconContainer.style.boxShadow = 'inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(107,153,195,0.15)';

    // 鎖頭圖示
    iconContainer.innerHTML = `<svg style="width: 28px; height: 28px; color: #6B99C3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>`;

    // 文字訊息
    const text = document.createElement('p');
    text.innerText = message;
    text.style.color = '#2A3F54';
    text.style.fontSize = '16px';
    text.style.fontWeight = '600';
    text.style.lineHeight = '1.6';
    text.style.margin = '0 0 28px';
    text.style.letterSpacing = '0.3px';

    // 按鈕容器
    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.flexDirection = 'column';
    btnGroup.style.gap = '12px';

    // 主按鈕 (前往登入)
    const confirmBtn = document.createElement('button');
    confirmBtn.innerText = '立即登入';
    confirmBtn.style.background = 'linear-gradient(135deg, #6B99C3 0%, #2A527A 100%)';
    confirmBtn.style.color = '#FFFFFF';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '99px';
    confirmBtn.style.padding = '14px 20px';
    confirmBtn.style.fontSize = '15px';
    confirmBtn.style.fontWeight = '700';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.transition = 'opacity 0.2s';
    confirmBtn.style.boxShadow = '0 8px 20px rgba(42, 82, 122, 0.2)';
    confirmBtn.onmouseenter = () => confirmBtn.style.opacity = '0.9';
    confirmBtn.onmouseleave = () => confirmBtn.style.opacity = '1';

    // 次按鈕 (先去逛逛)
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = '先去逛逛';
    cancelBtn.style.background = 'transparent';
    cancelBtn.style.color = '#87ACCA';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '99px';
    cancelBtn.style.padding = '10px 20px';
    cancelBtn.style.fontSize = '14px';
    cancelBtn.style.fontWeight = '600';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.transition = 'color 0.2s';
    cancelBtn.onmouseenter = () => cancelBtn.style.color = '#2A527A';
    cancelBtn.onmouseleave = () => cancelBtn.style.color = '#87ACCA';

    // 組合 DOM
    modal.appendChild(iconContainer);
    modal.appendChild(text);
    btnGroup.appendChild(confirmBtn);
    btnGroup.appendChild(cancelBtn);
    modal.appendChild(btnGroup);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 觸發進場動畫
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      modal.style.transform = 'scale(1) translateY(0)';
    });

    // 關閉並回傳結果
    const close = (result) => {
      overlay.style.opacity = '0';
      modal.style.transform = 'scale(0.95) translateY(10px)';
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        resolve(result);
      }, 250); // 動畫時間
    };

    confirmBtn.onclick = () => close(true);
    cancelBtn.onclick = () => close(false);
    overlay.onclick = (e) => {
      if (e.target === overlay) close(false);
    };
  });
}

export async function getCurrentUser() {
  // 這裡只需要知道瀏覽器是否已有登入 session。getSession() 在訪客狀態
  // 會正常回傳 null；getUser() 則可能把「沒有 session」當成例外，
  // 使公開頁面的靜默身份檢查意外中斷資料載入。
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data?.session?.user || null;
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
    const confirmed = await showLoginPrompt(message);
    if (!confirmed) {
      return null; // 若使用者點擊取消或點擊背景，則中止跳轉
    }
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
