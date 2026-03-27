const API_BASE = `http://${window.location.hostname}:5000/api`;

function setMessage(text) {
  const el = document.getElementById('auth-message');
  if (!el) return;
  el.textContent = text || '';
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('business-onboarding-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const email = document.getElementById('biz-onboard-email').value.trim();
      const code = document.getElementById('biz-onboard-code').value.trim();
      const password = document.getElementById('biz-onboard-password').value;

      const response = await fetch(`${API_BASE}/auth/business/verify/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || 'Failed to create business account');
        return;
      }

      setMessage('Business account created. Redirecting...');
      window.location.href = 'portal.html';
    } catch {
      setMessage('Backend not running yet.');
    }
  });
});

