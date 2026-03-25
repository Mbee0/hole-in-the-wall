const API_BASE = 'http://localhost:5000/api';

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

document.addEventListener('DOMContentLoaded', fetchHealth);
