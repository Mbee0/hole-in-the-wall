const API_BASE = window.getApiBase();

function setMessage(text) {
  const el = document.getElementById('profile-message');
  if (el) el.textContent = text || '';
}

function renderDealsSettings(preferences) {
  const host = document.getElementById('profile-deals');
  if (!host) return;

  const campus = preferences?.campus_name || 'Not set';
  const categories = (preferences?.preferred_categories || []).join(', ') || 'Not set';
  const notes = preferences?.notes || 'Not set';

  host.innerHTML = `
    <div class="table-row"><strong>Campus</strong><span>${campus}</span><span></span></div>
    <div class="table-row"><strong>Preferred categories</strong><span>${categories}</span><span></span></div>
    <div class="table-row"><strong>Notes</strong><span>${notes}</span><span></span></div>
  `;
}

async function init() {
  try {
    const meResp = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });
    const meData = await meResp.json();
    const user = meData.user;
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    document.getElementById('profile-name').textContent = user.name || '';
    document.getElementById('profile-email').textContent = user.email || '';
    document.getElementById('profile-type').textContent = user.account_type || '';

    const dashboardLink = document.getElementById('dashboard-link');
    if (dashboardLink) {
      dashboardLink.href = user.account_type === 'business' ? 'portal.html' : 'customer.html';
      dashboardLink.textContent = user.account_type === 'business' ? 'Restaurant Portal' : 'My Deals';
    }

    if (user.account_type === 'consumer') {
      const prefResp = await fetch(`${API_BASE}/customer/preferences`, {
        method: 'GET',
        credentials: 'include',
      });
      const prefData = await prefResp.json();
      renderDealsSettings(prefData.preferences || {});
    } else {
      renderDealsSettings({});
    }
  } catch {
    setMessage('Could not load profile information.');
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      window.location.href = 'index.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', init);


