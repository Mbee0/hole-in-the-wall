const API_BASE = `http://${window.location.hostname}:5000/api`;

async function submitAuth(event) {
  event.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const role = document.getElementById('role').value;
  const password = document.getElementById('password').value;
  const mode = document.getElementById('auth-mode')?.value || 'signup';
  const message = document.getElementById('auth-message');

  try {
    const endpoint = mode === 'login' ? `${API_BASE}/auth/login` : `${API_BASE}/auth/signup`;

    const body =
      mode === 'login'
        ? { email, password }
        : { name, email, password, account_type: role };

    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    message.textContent = data.message || data.error || 'Account created.';
    message.className = 'helper';

    if (!response.ok) return;

    const accountType = data.user?.account_type;
    if (accountType === 'consumer') {
      window.location.href = 'customer.html';
    } else if (accountType === 'business') {
      window.location.href = 'portal.html';
    } else {
      window.location.href = 'index.html';
    }
  } catch (error) {
    message.textContent = 'Backend not running yet. Your form structure is ready.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('auth-form');
  if (form) form.addEventListener('submit', submitAuth);
});
