const API_BASE = window.getApiBase();
const STORAGE_KEY = 'hitw_admin_api_key';

function getKey() {
  const input = document.getElementById('admin-api-key');
  return (input?.value || '').trim();
}

function setMessage(text, isError) {
  const el = document.getElementById('admin-message');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = isError ? '#6b1d1d' : '';
}

function authHeaders() {
  const key = getKey();
  const h = { 'Content-Type': 'application/json' };
  if (key) h['X-Admin-Api-Key'] = key;
  return h;
}

async function fetchUsers() {
  const res = await fetch(`${API_BASE}/admin/users`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Users request failed (${res.status})`);
  return data.users || [];
}

async function fetchBusinesses() {
  const res = await fetch(`${API_BASE}/admin/businesses`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Businesses request failed (${res.status})`);
  return data;
}

function readCheckedValues(selector) {
  return Array.from(document.querySelectorAll(selector))
    .filter((el) => el && el.checked)
    .map((el) => el.value);
}

async function createUnclaimedBusiness(payload) {
  const res = await fetch(`${API_BASE}/admin/businesses/unclaimed`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Create failed (${res.status})`);
  return data;
}

function renderUsers(users) {
  const tbody = document.getElementById('users-tbody');
  const wrap = document.getElementById('users-table-wrap');
  const loading = document.getElementById('users-loading');
  if (!tbody || !wrap || !loading) return;

  tbody.innerHTML = '';
  users.forEach((u) => {
    const tr = document.createElement('tr');
    const sus = u.suspicious || {};
    const flagged = !!sus.flagged;
    const badge = flagged
      ? '<span class="badge-risk">Review</span>'
      : '<span class="badge-ok">OK</span>';
    const reasons = (sus.reasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
    const stats = `<div class="small">${sus.events_last_hour ?? 0} / ${sus.events_last_24h ?? 0} events (1h / 24h) · ${sus.total_logged_events ?? 0} total</div>`;
    const reasonsBlock = flagged && reasons ? `<ul class="admin-reasons">${reasons}</ul>` : '';

    tr.innerHTML = `
      <td>${escapeHtml(u.name || '—')}</td>
      <td>${escapeHtml(u.account_type || '—')}</td>
      <td>${badge}${stats}${reasonsBlock}</td>
    `;
    tbody.appendChild(tr);
  });

  loading.hidden = true;
  wrap.hidden = users.length === 0;
  if (users.length === 0) {
    loading.hidden = false;
    loading.textContent = 'No user accounts found.';
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ADMIN_TOAST_COPY = {
  approve: {
    title: 'Inquiry approved — email sent',
    body: 'The restaurant contact should receive an onboarding message with a fresh six-digit code shortly.',
  },
  resend: {
    title: 'Replacement code emailed',
    body: 'We sent a new onboarding code to their inbox. Older codes from before will not work anymore.',
  },
};

/** @param {'approve' | 'resend' | 'error'} kind */
function showAdminToast(kind, errorDetail) {
  const root = document.getElementById('admin-toast-root');
  if (!root) return;

  let title;
  let body;
  if (kind === 'error') {
    title = 'Email was not sent';
    body = errorDetail || 'Check your admin key, SMTP settings, and try again.';
  } else {
    const copy = ADMIN_TOAST_COPY[kind];
    title = copy.title;
    body = copy.body;
  }

  const el = document.createElement('aside');
  el.className = `admin-toast admin-toast--${kind}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <strong class="admin-toast-title">${escapeHtml(title)}</strong>
    <p class="admin-toast-body">${escapeHtml(body)}</p>
  `;
  root.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add('admin-toast--visible');
  });

  const visibleMs = kind === 'error' ? 7500 : 5500;
  window.setTimeout(() => {
    el.classList.remove('admin-toast--visible');
    el.classList.add('admin-toast--leave');
    window.setTimeout(() => el.remove(), 300);
  }, visibleMs);
}

function inquiryCard(doc, { variant }) {
  const el = document.createElement('article');
  el.className = 'admin-inquiry-card';
  const title = escapeHtml(doc.business_name || 'Business');
  const sub = escapeHtml(doc.inquirer_name || '');
  const email = escapeHtml(doc.email || '');
  const phone = escapeHtml(doc.phone_number || '');
  const types = escapeHtml((doc.deal_types || []).join(', '));
  const blurb = escapeHtml(doc.blurb || '');
  const submitted = escapeHtml(doc.submitted_at || '—');

  let actions = '';
  if (variant === 'pending') {
    actions = `<button type="button" class="btn btn-primary admin-approve" data-id="${escapeHtml(doc.id)}">Approve &amp; email code</button>`;
  } else {
    actions = `
      <span class="badge-muted">Code sent — waiting on signup</span>
      <button type="button" class="btn btn-secondary admin-resend-code" data-id="${escapeHtml(doc.id)}">Resend onboarding code</button>
    `;
  }

  el.innerHTML = `
    <header>
      <h3>${title}</h3>
      <span class="badge-warn">${submitted}</span>
    </header>
    <div class="small">Contact: ${sub} · ${email} · ${phone}</div>
    <div class="small">Deal types: ${types}</div>
    <p class="admin-blurb">${blurb}</p>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">${actions}</div>
  `;
  return el;
}

async function approveInquiry(id) {
  const res = await fetch(`${API_BASE}/business-inquiries/${id}/approve`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Approve failed (${res.status})`);
  return data.message || 'Approved.';
}

async function resendOnboardingCode(id) {
  const res = await fetch(`${API_BASE}/business-inquiries/${id}/resend-code`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Resend failed (${res.status})`);
  return data.message || 'Code sent.';
}

function renderBusinesses(payload) {
  const pendingWrap = document.getElementById('pending-wrap');
  const awaitingWrap = document.getElementById('awaiting-wrap');
  const bizGrid = document.getElementById('biz-grid');
  const bizLoading = document.getElementById('biz-loading');
  if (!pendingWrap || !awaitingWrap || !bizGrid || !bizLoading) return;

  pendingWrap.innerHTML = '';
  (payload.pending_inquiries || []).forEach((doc) => {
    pendingWrap.appendChild(inquiryCard(doc, { variant: 'pending' }));
  });
  if (!payload.pending_inquiries || payload.pending_inquiries.length === 0) {
    pendingWrap.innerHTML = '<p class="helper">No inquiries waiting for approval.</p>';
  }

  awaitingWrap.innerHTML = '';
  (payload.awaiting_onboarding || []).forEach((doc) => {
    awaitingWrap.appendChild(inquiryCard(doc, { variant: 'awaiting' }));
  });
  if (!payload.awaiting_onboarding || payload.awaiting_onboarding.length === 0) {
    awaitingWrap.innerHTML = '<p class="helper">Nobody is stuck between approval and account creation.</p>';
  }

  bizGrid.innerHTML = '';
  (payload.businesses || []).forEach((b) => {
    const card = document.createElement('article');
    card.className = 'admin-biz-card';
    const act = b.activity || {};
    card.innerHTML = `
      <header>
        <h3 style="margin:0;font-size:1.05rem;">${escapeHtml(b.name || 'Business')}</h3>
        <span class="badge-muted">${escapeHtml(b.category || '')}</span>
      </header>
      <p class="small" style="margin:8px 0 4px;">${escapeHtml(b.address || '')}</p>
      <p class="admin-blurb" style="margin-top:6px;">${escapeHtml(b.story || '')}</p>
      <p class="small"><strong>Deal summary:</strong> ${escapeHtml(b.deal_summary || '—')}</p>
      <p class="small"><strong>Offer types:</strong> ${escapeHtml((b.offer_types || []).join(', '))}</p>
      <p class="small"><strong>Focus:</strong> ${escapeHtml((b.deal_focus || []).join(', '))}</p>
      <p class="small"><strong>Owner:</strong> ${escapeHtml(b.owner_name || '—')} · ${escapeHtml(b.owner_email || '')}</p>
      <p class="small"><strong>Posts (deals):</strong> ${act.posts_created ?? 0} · <strong>Last post:</strong> ${escapeHtml(act.last_post_at || '—')}</p>
      <p class="small"><strong>Claimed:</strong> ${b.claimed ? 'yes' : 'no'} · <strong>Lat/Lng:</strong> ${escapeHtml(String(b.lat ?? '—'))}, ${escapeHtml(String(b.lng ?? '—'))}</p>
    `;
    bizGrid.appendChild(card);
  });

  bizLoading.textContent =
    payload.businesses && payload.businesses.length ? '' : 'No business profiles in the database yet.';
}

function wireInquiryActionButtons(root) {
  root.querySelectorAll('.admin-approve').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      btn.disabled = true;
      try {
        const msg = await approveInquiry(id);
        setMessage(msg, false);
        const data = await fetchBusinesses();
        renderBusinesses(data);
        wireInquiryActionButtons(document);
      } catch (e) {
        setMessage(e.message || 'Approve failed', true);
        btn.disabled = false;
      }
    });
  });

  root.querySelectorAll('.admin-resend-code').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      btn.disabled = true;
      try {
        await resendOnboardingCode(id);
        showAdminToast('resend');
        setMessage('Last action: resent onboarding code by email.', false);
        const data = await fetchBusinesses();
        renderBusinesses(data);
        wireInquiryActionButtons(document);
      } catch (e) {
        showAdminToast('error', e.message || 'Resend failed.');
        setMessage(e.message || 'Resend failed', true);
        btn.disabled = false;
      }
    });
  });
}

function setTab(name) {
  const usersPanel = document.getElementById('panel-users');
  const bizPanel = document.getElementById('panel-businesses');
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    const active = tab.getAttribute('data-tab') === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (usersPanel) usersPanel.hidden = name !== 'users';
  if (bizPanel) bizPanel.hidden = name !== 'businesses';
}

async function refreshAll() {
  if (!getKey()) {
    setMessage('Enter your admin API key first.', true);
    return;
  }
  setMessage('Loading…', false);
  try {
    const users = await fetchUsers();
    renderUsers(users);
    const biz = await fetchBusinesses();
    renderBusinesses(biz);
    wireInquiryActionButtons(document);
    setMessage('Up to date.', false);
  } catch (e) {
    setMessage(e.message || 'Request failed', true);
  }
}

function wireAdminAddressAutocomplete() {
  const input = document.getElementById('admin-biz-address');
  const list = document.getElementById('admin-address-suggestions');
  const latEl = document.getElementById('admin-biz-lat');
  const lngEl = document.getElementById('admin-biz-lng');
  const hint = document.getElementById('admin-address-geocode-hint');
  if (!input || !list) return;

  let timer = null;
  let suppressGeocodeClear = false;

  function hideList() {
    list.hidden = true;
    list.innerHTML = '';
    input.removeAttribute('aria-expanded');
  }

  function selectSuggestion(s) {
    suppressGeocodeClear = true;
    input.value = (s.formatted_address || s.label || '').trim();
    if (latEl) latEl.value = String(s.lat ?? '');
    if (lngEl) lngEl.value = String(s.lng ?? '');
    suppressGeocodeClear = false;
    hideList();
    if (hint) {
      const hasCoords = !!(latEl?.value && lngEl?.value);
      hint.textContent = hasCoords
        ? 'Coordinates saved with this address.'
        : 'Coordinates missing for this suggestion.';
    }
  }

  input.addEventListener('input', () => {
    if (!suppressGeocodeClear) {
      if (latEl) latEl.value = '';
      if (lngEl) lngEl.value = '';
      if (hint) {
        hint.textContent = 'Pick an address suggestion to save coordinates.';
      }
    }

    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) {
      hideList();
      return;
    }

    timer = window.setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/places/autocomplete?q=${encodeURIComponent(q)}`);
        const data = await r.json().catch(() => ({}));
        const items = data.suggestions || [];

        list.innerHTML = '';
        if (!items.length) {
          hideList();
          return;
        }

        items.forEach((s) => {
          const li = document.createElement('li');
          li.setAttribute('role', 'option');
          li.textContent = s.label || s.formatted_address || '';
          li.addEventListener('mousedown', (e) => {
            // Prevent input blur from hiding the list before selection.
            e.preventDefault();
            selectSuggestion(s);
          });
          list.appendChild(li);
        });

        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
      } catch {
        hideList();
      }
    }, 320);
  });

  input.addEventListener('blur', () => {
    window.setTimeout(hideList, 180);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const keyInput = document.getElementById('admin-api-key');
  const saveBtn = document.getElementById('admin-save-key');
  const refreshBtn = document.getElementById('admin-refresh');
  const createForm = document.getElementById('admin-create-unclaimed');
  const createMsg = document.getElementById('admin-create-msg');
  const createDealToggle = document.getElementById('admin-create-deal');
  const dealFields = document.getElementById('admin-deal-fields');

  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved && keyInput) keyInput.value = saved;
  } catch {
    /* ignore */
  }

  wireAdminAddressAutocomplete();

  saveBtn?.addEventListener('click', () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, getKey());
      setMessage('Key stored for this browser session.', false);
    } catch {
      setMessage('Could not store key in session storage.', true);
    }
  });

  refreshBtn?.addEventListener('click', refreshAll);

  if (createDealToggle && dealFields) {
    const sync = () => {
      dealFields.style.display = createDealToggle.checked ? '' : 'none';
    };
    createDealToggle.addEventListener('change', sync);
    sync();
  }

  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!getKey()) {
      setMessage('Enter your admin API key first.', true);
      return;
    }
    if (createMsg) createMsg.textContent = '';

    const name = document.getElementById('admin-biz-name')?.value?.trim() || '';
    const category = document.getElementById('admin-biz-category')?.value || 'Restaurant';
    const phone = document.getElementById('admin-biz-phone')?.value?.trim() || '';
    const address = document.getElementById('admin-biz-address')?.value?.trim() || '';
    const latRaw = document.getElementById('admin-biz-lat')?.value;
    const lngRaw = document.getElementById('admin-biz-lng')?.value;
    const deal_summary = document.getElementById('admin-biz-deal-summary')?.value?.trim() || '';
    const offer_types = readCheckedValues('.admin-offer-type');

    const create_deal = !!createDealToggle?.checked;
    const deal_title = document.getElementById('admin-deal-title')?.value?.trim() || '';
    const deal_description = document.getElementById('admin-deal-description')?.value || '';

    const payload = {
      name,
      category,
      phone,
      address,
      deal_summary,
      offer_types,
      lat: latRaw === '' || latRaw == null ? null : Number.parseFloat(latRaw),
      lng: lngRaw === '' || lngRaw == null ? null : Number.parseFloat(lngRaw),
      create_deal,
      deal_title,
      deal_description,
    };

    const submitBtn = createForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const result = await createUnclaimedBusiness(payload);
      setMessage(`Created unclaimed listing: ${name}`, false);
      if (createMsg) createMsg.textContent = `Saved. Business id: ${result.business_id}`;
      const biz = await fetchBusinesses();
      renderBusinesses(biz);
      wireInquiryActionButtons(document);
      createForm.reset();
      if (createDealToggle) createDealToggle.checked = true;
      if (dealFields) dealFields.style.display = '';
    } catch (err) {
      setMessage(err.message || 'Create listing failed', true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.getAttribute('data-tab') || 'users';
      setTab(name);
    });
  });

  setTab('users');
});
