const API_BASE = 'http://localhost:5000/api';

async function submitBusiness(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('business-name').value.trim(),
    category: document.getElementById('business-category').value,
    address: document.getElementById('business-address').value.trim(),
    deal_summary: document.getElementById('deal-summary').value.trim(),
    story: document.getElementById('business-story').value.trim(),
    claimed: true
  };

  const message = document.getElementById('portal-message');

  try {
    const response = await fetch(`${API_BASE}/businesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    message.textContent = data.name
      ? `Saved: ${data.name}`
      : (data.error || 'Something went wrong');
  } catch (error) {
    message.textContent = 'Backend not running yet. This dashboard form is ready to connect.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('business-form');
  if (form) form.addEventListener('submit', submitBusiness);
});
