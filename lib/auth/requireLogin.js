import { supabase } from '@/lib/supabase/client';

const DEFAULT_LOGIN_MESSAGE = '請先登入';

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
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '999999';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';

    // 建立彈窗容器 (WeChat / iOS 警告框風格)
    const modal = document.createElement('div');
    modal.style.backgroundColor = 'var(--bg-surface)';
    modal.style.borderRadius = '16px';
    modal.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.2)';
    modal.style.width = '80%';
    modal.style.maxWidth = '300px';
    modal.style.textAlign = 'center';
    modal.style.transform = 'scale(0.95)';
    modal.style.transition = 'transform 0.2s ease';
    modal.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    modal.style.overflow = 'hidden';

    // 內容區
    const contentBox = document.createElement('div');
    contentBox.style.padding = '36px 24px 28px';

    // 文字訊息
    const text = document.createElement('p');
    text.innerText = message;
    text.style.color = 'var(--text-primary)';
    text.style.fontSize = '17px';
    text.style.fontWeight = '500';
    text.style.lineHeight = '1.5';
    text.style.margin = '0';

    contentBox.appendChild(text);

    // 按鈕群組 (左右佈局，上方有橫線，中間有豎線)
    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.borderTop = '1px solid var(--border-light)';

    // 次按鈕 (取消/先去逛逛)
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = '先去逛逛';
    cancelBtn.style.flex = '1';
    cancelBtn.style.background = 'transparent';
    cancelBtn.style.color = 'var(--text-secondary)';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRight = '1px solid var(--border-light)';
    cancelBtn.style.padding = '14px 0';
    cancelBtn.style.fontSize = '17px';
    cancelBtn.style.fontWeight = '400';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.outline = 'none';
    cancelBtn.style.borderRadius = '0';

    // 主按鈕 (確認/登入)
    const confirmBtn = document.createElement('button');
    confirmBtn.innerText = '立即登入';
    confirmBtn.style.flex = '1';
    confirmBtn.style.background = 'transparent';
    confirmBtn.style.color = 'var(--brand-blue)';
    confirmBtn.style.border = 'none';
    confirmBtn.style.padding = '14px 0';
    confirmBtn.style.fontSize = '17px';
    confirmBtn.style.fontWeight = '600';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.outline = 'none';
    confirmBtn.style.borderRadius = '0';

    // 觸控回饋
    const addFeedback = (btn) => {
      btn.onmousedown = () => btn.style.backgroundColor = 'var(--bg-base)';
      btn.onmouseup = () => btn.style.backgroundColor = 'transparent';
      btn.onmouseleave = () => btn.style.backgroundColor = 'transparent';
      btn.ontouchstart = () => btn.style.backgroundColor = 'var(--bg-base)';
      btn.ontouchend = () => setTimeout(() => btn.style.backgroundColor = 'transparent', 200);
    };
    addFeedback(cancelBtn);
    addFeedback(confirmBtn);

    // 組合 DOM
    modal.appendChild(contentBox);
    btnGroup.appendChild(cancelBtn);
    btnGroup.appendChild(confirmBtn);
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
