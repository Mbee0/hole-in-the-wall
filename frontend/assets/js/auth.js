const API_BASE = 'http://localhost:5000/api';

async function submitAuth(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const role = document.getElementById('role').value;
  const message = document.getElementById('auth-message');

  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role })
    });

    const data = await response.json();
    message.textContent = data.message || data.error;
    message.className = 'helper';
  } catch (error) {
    message.textContent = 'Backend not running yet. Your form structure is ready.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('auth-form');
  if (form) form.addEventListener('submit', submitAuth);
});
