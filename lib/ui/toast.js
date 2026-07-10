export function showToast(message, type = 'error') {
  if (typeof window === 'undefined') return;

  const toast = document.createElement('div');
  toast.innerText = message;
  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translate(-50%, -20px)';
  toast.style.backgroundColor = type === 'error' ? 'rgba(159, 94, 76, 0.9)' : 'rgba(107, 153, 195, 0.9)';
  toast.style.color = '#FFFFFF';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '99px';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '600';
  toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.1)';
  toast.style.backdropFilter = 'blur(10px)';
  toast.style.WebkitBackdropFilter = 'blur(10px)';
  toast.style.zIndex = '9999999';
  toast.style.opacity = '0';
  toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
  toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translate(-50%, 0)';
    toast.style.opacity = '1';
  });

  setTimeout(() => {
    toast.style.transform = 'translate(-50%, -20px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}
