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

function readSelectedCategories() {
  return Array.from(document.querySelectorAll('.pref-category:checked')).map((cb) => cb.value);
}

async function submitSignup(event) {
  event.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;

  const campusName = document.getElementById('campus-name')?.value?.trim() || '';
  const notes = document.getElementById('preference-notes')?.value?.trim() || '';

  const payload = {
    name,
    email,
    password,
    account_type: role,
    preferences: {
      campus_name: campusName,
      preferred_categories: readSelectedCategories(),
      notes,
    },
  };

  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Signup failed');
      return;
    }

    setMessage(data.message || 'Account created.');
    redirectByAccountType(data.user?.account_type);
  } catch (e) {
    setMessage('Backend not running yet.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signup-form');
  if (form) form.addEventListener('submit', submitSignup);
});

