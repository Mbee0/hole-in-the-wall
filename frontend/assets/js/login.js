const API_BASE = `http://${window.location.hostname}:5000/api`;

function setMessage(text) {
  const el = document.getElementById('auth-message');
  if (!el) return;
  el.textContent = text || '';
}

function redirectByAccountType(accountType) {
  if (accountType === 'consumer') {
    window.location.href = 'customer.html';
  } else if (accountType === 'business') {
    window.location.href = 'portal.html';
  } else {
    window.location.href = 'index.html';
  }
}

async function submitLogin(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Login failed');
      return;
    }

    setMessage(data.message || 'Login successful');
    redirectByAccountType(data.user?.account_type);
  } catch (e) {
    setMessage('Backend not running yet.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (form) form.addEventListener('submit', submitLogin);
});

