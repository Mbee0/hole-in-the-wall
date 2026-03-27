const API_BASE = window.getApiBase();

function getCheckedValues(selector) {
  return Array.from(document.querySelectorAll(`${selector}:checked`)).map((el) => el.value);
}

async function requireBusinessAuth() {
  const message = document.getElementById('portal-message');
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();

    if (!data.user) {
      window.location.href = 'login.html';
      return null;
    }

    if (data.user.account_type !== 'business') {
      if (data.user.account_type === 'consumer') {
        window.location.href = 'customer.html';
        return null;
      }
      if (message) message.textContent = 'This portal is for restaurant accounts.';
      return null;
    }

    return data.user;
  } catch (e) {
    if (message) message.textContent = 'Backend unavailable.';
    return null;
  }
}

async function submitBusiness(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('business-name').value.trim(),
    category: document.getElementById('business-category').value,
    address: document.getElementById('business-address').value.trim(),
    deal_summary: document.getElementById('deal-summary').value.trim(),
    story: document.getElementById('business-story').value.trim(),
    claimed: true,
    offer_types: getCheckedValues('.offer-type'),
    deal_focus: getCheckedValues('.deal-focus'),
  };

  const message = document.getElementById('portal-message');

  try {
    const response = await fetch(`${API_BASE}/businesses`, {
      method: 'POST',
      credentials: 'include',
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

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireBusinessAuth();
  if (!user) return;

  const form = document.getElementById('business-form');
  if (form) form.addEventListener('submit', submitBusiness);
});

