const API_BASE = `http://${window.location.hostname}:5000/api`;

function setNavForAuth(user) {
  const studentLink = document.getElementById('student-dashboard-link');
  const businessLink = document.getElementById('restaurant-portal-link');
  const signInLink = document.getElementById('sign-in-link');
  const profileLink = document.getElementById('profile-link');

  if (studentLink) studentLink.style.display = 'none';
  if (businessLink) businessLink.style.display = 'none';
  if (signInLink) signInLink.style.display = '';
  if (profileLink) profileLink.style.display = 'none';

  if (!user) return;

  if (user.account_type === 'consumer') {
    if (studentLink) studentLink.style.display = '';
  } else if (user.account_type === 'business') {
    if (businessLink) businessLink.style.display = '';
  }

  if (signInLink) signInLink.style.display = 'none';
  if (profileLink) profileLink.style.display = '';
}

async function fetchHealth() {
  const el = document.getElementById('api-status');
  if (!el) return;

  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    el.textContent = data.status === 'ok' ? 'API connected' : 'API unavailable';
  } catch (error) {
    el.textContent = 'API offline during static preview';
  }
}

async function checkAuthState() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    const user = data.user;

    setNavForAuth(user);
  } catch {
    // Keep public UI visible if auth check fails.
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuthState();
  fetchHealth();
});
