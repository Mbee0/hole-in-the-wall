const API_BASE = window.getApiBase();

function setMessage(text) {
  const el = document.getElementById('customer-message');
  if (!el) return;
  el.textContent = text || '';
}

async function requireConsumerAuth() {
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
    if (data.user.account_type !== 'consumer') {
      if (data.user.account_type === 'business') {
        window.location.href = 'portal.html';
        return null;
      }
      setMessage('This dashboard is for consumer/student accounts.');
      return null;
    }
    return data.user;
  } catch (e) {
    setMessage('Backend unavailable.');
    return null;
  }
}

async function loadBusinesses() {
  const response = await fetch(`${API_BASE}/businesses`, { method: 'GET' });
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function loadSavedDeals() {
  const response = await fetch(`${API_BASE}/customer/saved-deals`, { credentials: 'include' });
  if (response.status === 401 || response.status === 403) {
    window.location.href = 'login.html';
    return [];
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load saved deals');
  }
  return data.saved_deals || [];
}

function normalizeName(name) {
  return (name || '').toLowerCase().trim();
}

function renderSavedDeals(savedDeals, businesses) {
  const list = document.getElementById('saved-deals-list');
  if (!list) return;
  list.innerHTML = '';

  if (!savedDeals || savedDeals.length === 0) {
    list.textContent = 'No saved deals yet.';
    return;
  }

  const bizByName = new Map();
  (businesses || []).forEach((b) => {
    const key = normalizeName(b.name);
    if (key) bizByName.set(key, b);
  });

  savedDeals.forEach((deal) => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const expires = deal.expires ? ` • Expires: ${deal.expires}` : '';
    const studentOnly = deal.student_only ? 'Student-only' : 'Open';
    const biz = bizByName.get(normalizeName(deal.business_name));
    const viewBizLink = biz?.id
      ? `<a class="btn btn-secondary" href="business.html?id=${encodeURIComponent(biz.id)}">View business</a>`
      : '';

    card.innerHTML = `
      <h3>${deal.title || 'Deal'}</h3>
      <div class="meta">
        <span>${deal.business_name || ''}</span>
        <span>${deal.deal_type || 'Student Deal'}</span>
        <span>${studentOnly}${expires}</span>
      </div>
      <div class="section helper" style="padding: 0; margin-top: 8px;">
        ${deal.description || ''}
      </div>
      <div class="cta-row" style="margin-top: 10px;">
        ${viewBizLink}
      </div>
    `;

    list.appendChild(card);
  });
}

async function saveDeal(dealId) {
  const response = await fetch(`${API_BASE}/customer/save-deal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ deal_id: dealId }),
  });
  const data = await response.json();
  if (!response.ok) {
    setMessage(data.error || 'Failed to save deal');
    return;
  }
  setMessage('Deal saved.');
  await refreshSavedDeals();
}

async function init() {
  const user = await requireConsumerAuth();
  if (!user) return;

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

  await refreshSavedDeals();
}

async function refreshSavedDeals() {
  try {
    const [savedDeals, businesses] = await Promise.all([loadSavedDeals(), loadBusinesses()]);
    renderSavedDeals(savedDeals, businesses);
  } catch (e) {
    setMessage('Could not load saved deals.');
  }
}

document.addEventListener('DOMContentLoaded', init);


