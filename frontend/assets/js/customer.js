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

function readSelectedCategories() {
  return Array.from(document.querySelectorAll('.pref-category:checked')).map(
    (cb) => cb.value
  );
}

function renderDeals(deals, savedDealIds) {
  const list = document.getElementById('deals-list');
  if (!list) return;
  list.innerHTML = '';

  if (!deals || deals.length === 0) {
    list.textContent = 'No deals found.';
    return;
  }

  deals.forEach((deal) => {
    const isSaved = savedDealIds.has(deal.id);
    const card = document.createElement('div');
    card.className = 'result-card';

    const expires = deal.expires ? ` • Expires: ${deal.expires}` : '';
    const studentOnly = deal.student_only ? 'Student-only' : 'Open';

    card.innerHTML = `
      <h3>${deal.title || 'Untitled deal'}</h3>
      <div class="meta">
        <span>${deal.business_name || 'Unknown business'}</span>
        <span>${deal.deal_type || 'Student Deal'}</span>
        <span>${studentOnly}${expires}</span>
      </div>
      <div class="section helper" style="padding: 0; margin-top: 8px;">
        ${deal.description ? deal.description : ''}
      </div>
      <div class="cta-row" style="margin-top: 10px;">
        <button class="btn btn-secondary" data-action="save-deal" ${isSaved ? 'disabled' : ''}>
          ${isSaved ? 'Saved' : 'Save deal'}
        </button>
        <button class="btn btn-primary" data-action="log-viewed">
          Log viewed
        </button>
      </div>
    `;

    card.querySelector('[data-action="save-deal"]').addEventListener('click', async () => {
      await saveDeal(deal.id);
    });
    card.querySelector('[data-action="log-viewed"]').addEventListener('click', async () => {
      await logViewedDeal(deal);
    });

    list.appendChild(card);
  });
}

async function loadDeals() {
  const response = await fetch(`${API_BASE}/deals`, { method: 'GET' });
  const deals = await response.json();
  return deals || [];
}

async function fetchPreferences() {
  const response = await fetch(`${API_BASE}/customer/preferences`, { credentials: 'include' });
  const data = await response.json();
  return data.preferences || {};
}

async function putPreferences(payload) {
  const response = await fetch(`${API_BASE}/customer/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to save preferences');
  return data.preferences || payload;
}

async function loadActivity() {
  const response = await fetch(`${API_BASE}/customer/activity`, { credentials: 'include' });
  const data = await response.json();
  return data.activity || [];
}

function renderActivity(activity) {
  const list = document.getElementById('activity-list');
  if (!list) return;
  list.innerHTML = '';

  if (!activity || activity.length === 0) {
    list.textContent = 'No activity yet.';
    return;
  }

  activity.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <strong>${entry.action}</strong>
      <span>${entry.entity_type || '—'}</span>
      <span>${entry.entity_id || ''}</span>
    `;
    list.appendChild(row);
  });
}

async function loadSavedDeals() {
  const response = await fetch(`${API_BASE}/customer/saved-deals`, { credentials: 'include' });
  const data = await response.json();
  return data.saved_deals || [];
}

function renderSavedDeals(savedDeals) {
  const list = document.getElementById('saved-deals-list');
  if (!list) return;
  list.innerHTML = '';

  if (!savedDeals || savedDeals.length === 0) {
    list.textContent = 'No saved deals yet.';
    return;
  }

  savedDeals.forEach((deal) => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <strong>${deal.title || 'Untitled deal'}</strong>
      <span>${deal.business_name || ''}</span>
      <span>${deal.deal_type || ''}</span>
    `;
    list.appendChild(row);
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
  await refreshSavedAndDeals();
}

async function logViewedDeal(deal) {
  const response = await fetch(`${API_BASE}/customer/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      action: 'viewed_deal',
      entity_type: 'deal',
      entity_id: deal.id,
      metadata: { title: deal.title, business_name: deal.business_name },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    setMessage(data.error || 'Failed to log viewed deal');
    return;
  }

  setMessage('View logged.');
  await refreshActivity();
}

async function refreshActivity() {
  const activity = await loadActivity();
  renderActivity(activity);
}

async function refreshSavedAndDeals() {
  const savedDeals = await loadSavedDeals();
  renderSavedDeals(savedDeals);

  const savedDealIds = new Set(savedDeals.map((d) => d.id));
  const deals = await loadDeals();
  renderDeals(deals, savedDealIds);
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

  const form = document.getElementById('preferences-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          campus_name: document.getElementById('campus-name').value.trim(),
          preferred_categories: readSelectedCategories(),
          notes: document.getElementById('preference-notes').value.trim(),
        };

        await putPreferences(payload);
        setMessage('My deals settings saved.');
      } catch (err) {
        setMessage(err.message || 'Failed to save my deals settings');
      }
    });
  }

  const prefs = await fetchPreferences();

  document.getElementById('campus-name').value = prefs.campus_name || '';
  const selected = new Set(prefs.preferred_categories || []);
  document.querySelectorAll('.pref-category').forEach((cb) => {
    cb.checked = selected.has(cb.value);
  });
  const notes = document.getElementById('preference-notes');
  if (notes) notes.value = prefs.notes || '';

  await refreshActivity();
  await refreshSavedAndDeals();
}

document.addEventListener('DOMContentLoaded', init);


