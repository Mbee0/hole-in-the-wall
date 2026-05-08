const API_BASE = window.getApiBase();

/** @type {object | null} */
let currentBusiness = null;
let allDealsCache = [];

/** Inquiry draft from initial business application (GET /business-inquiries/mine). */
let onboardingInquiry = null;

/** Skip clearing geocode coords when programmatically filling the address field. */
let suppressAddressGeocodeClear = false;

function inquiryDealLabelsToOfferTypes(labels) {
  const out = [];
  (labels || []).forEach((raw) => {
    const s = String(raw).toLowerCase().trim();
    if (!s) return;
    if ((s.includes('student') && s.includes('deal')) || s === 'student deals') {
      if (!out.includes('deals')) out.push('deals');
      return;
    }
    if (s.includes('cater')) {
      if (!out.includes('catering')) out.push('catering');
      return;
    }
    if (s.includes('fundrais')) {
      if (!out.includes('fundraising')) out.push('fundraising');
      return;
    }
  });
  return out;
}

async function fetchOnboardingInquiry() {
  try {
    const r = await fetch(`${API_BASE}/business-inquiries/mine`, { credentials: 'include' });
    if (!r.ok) return null;
    const data = await r.json().catch(() => ({}));
    return data.inquiry || null;
  } catch {
    return null;
  }
}

function applyInquiryToSettingsForm(inq) {
  if (!inq) return;
  const nameEl = document.getElementById('settings-name');
  const storyEl = document.getElementById('settings-story');
  if (nameEl) nameEl.value = inq.business_name || '';
  if (storyEl) storyEl.value = inq.blurb || '';
  document.querySelectorAll('.settings-offer-type').forEach((cb) => {
    cb.checked = false;
  });
  inquiryDealLabelsToOfferTypes(inq.deal_types).forEach((v) => {
    document.querySelectorAll('.settings-offer-type').forEach((cb) => {
      if (cb.value === v) cb.checked = true;
    });
  });
}

function applyInquiryToMyPageForm(inq) {
  if (!inq) return;
  const phoneEl = document.getElementById('mp-phone');
  const ce = document.getElementById('mp-contact-email');
  if (phoneEl) phoneEl.value = inq.phone_number || '';
  if (ce) ce.value = String(inq.email || '').trim();
}

function applyInquiryFillGapsForExistingBusiness(inq) {
  if (!inq || !currentBusiness) return;
  const nameEl = document.getElementById('settings-name');
  if (nameEl && !(currentBusiness.name || '').trim()) {
    nameEl.value = inq.business_name || nameEl.value;
  }
  const storyEl = document.getElementById('settings-story');
  if (storyEl && !(currentBusiness.story || '').trim()) {
    storyEl.value = inq.blurb || storyEl.value;
  }
  const noOffers = !((currentBusiness.offer_types || []).length);
  if (noOffers) {
    document.querySelectorAll('.settings-offer-type').forEach((cb) => {
      cb.checked = false;
    });
    inquiryDealLabelsToOfferTypes(inq.deal_types).forEach((v) => {
      document.querySelectorAll('.settings-offer-type').forEach((cb) => {
        if (cb.value === v) cb.checked = true;
      });
    });
  }
  const phoneEl = document.getElementById('mp-phone');
  if (phoneEl && !(currentBusiness.phone || '').trim()) {
    phoneEl.value = inq.phone_number || phoneEl.value;
  }
  const ce = document.getElementById('mp-contact-email');
  if (ce && !(currentBusiness.contact_email || '').trim()) {
    ce.value = String(inq.email || '').trim() || ce.value;
  }
}

function getCheckedValues(selector) {
  return Array.from(document.querySelectorAll(`${selector}:checked`)).map((el) => el.value);
}

function textToUrlLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDealDates(deal) {
  if (deal.no_end_date) {
    const start = deal.valid_from ? `From ${deal.valid_from}` : '';
    return start ? `${start} · Ongoing` : 'Ongoing (no end date)';
  }
  const parts = [];
  if (deal.valid_from) parts.push(`Starts ${deal.valid_from}`);
  if (deal.expires) parts.push(`Ends ${deal.expires}`);
  return parts.length ? parts.join(' · ') : 'Dates not set';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toDateInputValue(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    /* ignore */
  }
  return '';
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
  } catch {
    if (message) message.textContent = 'Backend unavailable.';
    return null;
  }
}

function dealsForCurrentBusiness() {
  if (!currentBusiness) return [];
  const bid = String(currentBusiness.id || '');
  const name = (currentBusiness.name || '').toLowerCase().trim();
  return allDealsCache.filter((d) => {
    const dbid = String(d.business_id || '');
    if (bid && dbid === bid) return true;
    return (d.business_name || '').toLowerCase().trim() === name;
  });
}

function setGlobalMessage(text, isError) {
  const el = document.getElementById('portal-message');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = isError ? '#6b1d1d' : '';
}

function showPanel(panelId) {
  document.querySelectorAll('.portal-panel').forEach((p) => {
    p.hidden = p.id !== `panel-${panelId}`;
  });
  document.querySelectorAll('.portal-nav').forEach((a) => {
    const active = a.getAttribute('data-panel') === panelId;
    a.classList.toggle('active', active);
  });
}

function bindNavigation() {
  document.querySelectorAll('.portal-nav').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const panel = link.getAttribute('data-panel');
      if (panel) showPanel(panel);
    });
  });
  document.querySelectorAll('.portal-jump-settings').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showPanel('settings');
    });
  });
}

async function refreshDealsCache() {
  try {
    const resp = await fetch(`${API_BASE}/deals`);
    allDealsCache = resp.ok ? await resp.json() : [];
  } catch {
    allDealsCache = [];
  }
}

async function loadMyBusiness() {
  await refreshDealsCache();
  onboardingInquiry = await fetchOnboardingInquiry();

  try {
    const resp = await fetch(`${API_BASE}/businesses/my`, { credentials: 'include' });
    const data = await resp.json().catch(() => []);
    currentBusiness = Array.isArray(data) && data.length ? data[0] : null;
  } catch {
    currentBusiness = null;
  }

  const banner = document.getElementById('portal-banner');
  const ovEmpty = document.getElementById('overview-empty');
  const ovFilled = document.getElementById('overview-filled');
  const myNeeds = document.getElementById('my-page-needs-business');
  const myEditor = document.getElementById('my-page-editor');
  const dealsNeeds = document.getElementById('deals-needs-business');
  const dealsWs = document.getElementById('deals-workspace');

  if (!currentBusiness) {
    if (banner) {
      banner.hidden = false;
      banner.textContent = onboardingInquiry
        ? 'We imported answers from your business application. Review them and tap Save to database under Settings.'
        : 'Welcome — create your business listing under Settings to unlock My Page and Deals.';
    }
    if (ovEmpty) ovEmpty.hidden = false;
    if (ovFilled) ovFilled.hidden = true;
    if (myNeeds) myNeeds.hidden = false;
    if (myEditor) myEditor.hidden = true;
    if (dealsNeeds) dealsNeeds.hidden = false;
    if (dealsWs) dealsWs.hidden = true;
    populateSettingsForm(null);
    populateMyPageForm({
      gallery_urls: [],
      website: '',
      phone: '',
      contact_email: '',
      allow_contact_email: false,
    });
    if (onboardingInquiry) {
      applyInquiryToSettingsForm(onboardingInquiry);
      applyInquiryToMyPageForm(onboardingInquiry);
    }
    return;
  }

  if (banner) banner.hidden = true;
  if (ovEmpty) ovEmpty.hidden = true;
  if (ovFilled) ovFilled.hidden = false;
  if (myNeeds) myNeeds.hidden = true;
  if (myEditor) myEditor.hidden = false;
  if (dealsNeeds) dealsNeeds.hidden = true;
  if (dealsWs) dealsWs.hidden = false;

  fillOverview(currentBusiness);
  populateSettingsForm(currentBusiness);
  populateMyPageForm(currentBusiness);
  applyInquiryFillGapsForExistingBusiness(onboardingInquiry);
  renderLivePreview();
  renderDealsGrid();

  const openPublic = document.getElementById('portal-open-public');
  if (openPublic && currentBusiness.id) {
    openPublic.href = `business.html?id=${encodeURIComponent(currentBusiness.id)}`;
  }
}

function fillOverview(b) {
  const name = document.getElementById('ov-name');
  const cat = document.getElementById('ov-category');
  const addr = document.getElementById('ov-address');
  const summary = document.getElementById('ov-deal-summary');
  const story = document.getElementById('ov-story');
  const ot = document.getElementById('ov-offer-types');
  const df = document.getElementById('ov-deal-focus');

  if (name) name.textContent = b.name || '—';
  if (cat) cat.textContent = b.category || '—';
  if (addr) addr.textContent = b.address || '—';
  if (summary) summary.textContent = b.deal_summary || '—';
  if (story) story.textContent = b.story || '—';
  if (ot) ot.textContent = (b.offer_types || []).length ? `Offer types: ${b.offer_types.join(', ')}` : 'No offer types set.';
  if (df) df.textContent = (b.deal_focus || []).length ? `Deal focus: ${b.deal_focus.join(', ')}` : 'No deal focus set.';
}

function populateSettingsForm(b) {
  const name = document.getElementById('settings-name');
  const cat = document.getElementById('settings-category');
  const addr = document.getElementById('settings-address');
  const latEl = document.getElementById('settings-lat');
  const lngEl = document.getElementById('settings-lng');
  const summary = document.getElementById('settings-deal-summary');
  const story = document.getElementById('settings-story');
  const geoHint = document.getElementById('address-geocode-hint');

  if (!name) return;

  document.querySelectorAll('.settings-offer-type').forEach((cb) => {
    cb.checked = false;
  });
  document.querySelectorAll('.settings-deal-focus').forEach((cb) => {
    cb.checked = false;
  });

  suppressAddressGeocodeClear = true;

  if (!b) {
    name.value = '';
    if (cat) cat.selectedIndex = 0;
    if (addr) addr.value = '';
    if (latEl) latEl.value = '';
    if (lngEl) lngEl.value = '';
    if (summary) summary.value = '';
    if (story) story.value = '';
    if (geoHint) {
      geoHint.textContent =
        'Type at least three characters, then pick a suggestion so the map uses validated coordinates.';
    }
    suppressAddressGeocodeClear = false;
    return;
  }

  name.value = b.name || '';
  if (cat) {
    const opts = Array.from(cat.options).map((o) => o.value);
    cat.value = opts.includes(b.category) ? b.category : cat.value;
  }
  if (addr) addr.value = b.address || '';
  if (latEl) latEl.value = b.lat != null && b.lat !== '' ? String(b.lat) : '';
  if (lngEl) lngEl.value = b.lng != null && b.lng !== '' ? String(b.lng) : '';
  if (summary) summary.value = b.deal_summary || '';
  if (story) story.value = b.story || '';

  if (geoHint) {
    geoHint.textContent =
      latEl?.value && lngEl?.value
        ? 'Saved coordinates match this listing. Edit the address and pick a new suggestion to update the map pin.'
        : 'Type at least three characters, then pick a suggestion so the map uses validated coordinates.';
  }

  suppressAddressGeocodeClear = false;

  document.querySelectorAll('.settings-offer-type').forEach((cb) => {
    cb.checked = (b.offer_types || []).includes(cb.value);
  });
  document.querySelectorAll('.settings-deal-focus').forEach((cb) => {
    cb.checked = (b.deal_focus || []).includes(cb.value);
  });
}

function populateMyPageForm(b) {
  const gallery = document.getElementById('mp-gallery');
  const website = document.getElementById('mp-website');
  const phone = document.getElementById('mp-phone');
  const email = document.getElementById('mp-contact-email');
  const allow = document.getElementById('mp-allow-email');

  if (gallery) gallery.value = (b.gallery_urls || []).join('\n');
  if (website) website.value = b.website || '';
  if (phone) phone.value = b.phone || '';
  if (email) email.value = b.contact_email || '';
  if (allow) allow.checked = !!b.allow_contact_email;
}

function renderLivePreview() {
  const host = document.getElementById('portal-live-preview');
  if (!host || !currentBusiness) return;

  const b = currentBusiness;
  const deals = dealsForCurrentBusiness();
  const gallery = (b.gallery_urls || []).filter(Boolean);
  const heroUrl = gallery[0];

  const chips = [b.claimed ? 'Claimed' : 'Unclaimed', b.category || 'Uncategorized'];

  const offerLabels = []
    .concat((b.offer_types || []).map((x) => `Offer: ${x.charAt(0).toUpperCase()}${x.slice(1)}`))
    .concat((b.deal_focus || []).map((x) => `Deal: ${x.charAt(0).toUpperCase()}${x.slice(1)}`));

  let dealsHtml = '';
  if (!deals.length) {
    dealsHtml = `<div class="card portal-mini-card"><strong>${escapeHtml(b.deal_summary || 'No active deals listed yet.')}</strong></div>`;
  } else {
    dealsHtml = deals
      .map((deal) => {
        const img =
          (deal.image_urls || []).find((u) => u) &&
          `<div class="portal-mini-thumb"><img src="${escapeHtml((deal.image_urls || [])[0])}" alt=""></div>`;
        return `
        <div class="card portal-mini-card portal-mini-deal">
          ${img || ''}
          <div>
            <strong>${escapeHtml(deal.title || 'Deal')}</strong>
            <p class="small">${escapeHtml(deal.description || '')}</p>
            <p class="small muted">${escapeHtml(formatDealDates(deal))}</p>
          </div>
        </div>`;
      })
      .join('');
  }

  let galleryHtml = '';
  if (gallery.length) {
    galleryHtml = `<div class="portal-preview-gallery">${gallery
      .slice(0, 6)
      .map((url) => `<img src="${escapeHtml(url)}" alt="">`)
      .join('')}</div>`;
  } else {
    galleryHtml = `<div class="portal-preview-hero-placeholder">Add gallery URLs to showcase photos</div>`;
  }

  const websiteRow = b.website
    ? `<p class="small"><strong>Website:</strong> <span class="portal-preview-faux-link">${escapeHtml(b.website)}</span></p>`
    : '';
  const phoneRow = b.phone ? `<p class="small"><strong>Phone:</strong> ${escapeHtml(b.phone)}</p>` : '';
  let emailRow = '';
  if (b.allow_contact_email && b.contact_email) {
    emailRow = `<p class="small"><strong>Email:</strong> ${escapeHtml(b.contact_email)}</p>`;
  }

  host.innerHTML = `
    <div class="portal-preview-inner">
      ${heroUrl ? `<div class="portal-preview-hero"><img src="${escapeHtml(heroUrl)}" alt=""></div>` : `<div class="portal-preview-hero-placeholder">Gallery hero</div>`}
      ${gallery.length > 1 ? galleryHtml : heroUrl ? '' : galleryHtml}
      <div class="portal-preview-meta">
        ${chips.map((c) => `<span class="filter-chip">${escapeHtml(c)}</span>`).join('')}
      </div>
      <h3 class="portal-preview-name">${escapeHtml(b.name || 'Your business')}</h3>
      <p class="small portal-pre-wrap">${escapeHtml(b.story || '')}</p>
      <h4 class="portal-preview-sub">Current deals</h4>
      ${dealsHtml}
      <h4 class="portal-preview-sub">What we offer</h4>
      <div class="portal-preview-meta">
        ${offerLabels.length ? offerLabels.map((l) => `<span class="filter-chip">${escapeHtml(l)}</span>`).join('') : '<span class="small">No tags yet.</span>'}
      </div>
      <h4 class="portal-preview-sub">Visit</h4>
      <p class="small"><strong>Address:</strong> ${escapeHtml(b.address || '—')}</p>
      ${websiteRow}${phoneRow}${emailRow}
    </div>
  `;
}

async function submitSettings(event) {
  event.preventDefault();
  const msg = document.getElementById('settings-msg');
  const payload = {
    name: document.getElementById('settings-name').value.trim(),
    category: document.getElementById('settings-category').value,
    address: document.getElementById('settings-address').value.trim(),
    deal_summary: document.getElementById('settings-deal-summary').value.trim(),
    story: document.getElementById('settings-story').value.trim(),
    claimed: true,
    offer_types: getCheckedValues('.settings-offer-type'),
    deal_focus: getCheckedValues('.settings-deal-focus'),
  };

  const latRaw = document.getElementById('settings-lat')?.value?.trim();
  const lngRaw = document.getElementById('settings-lng')?.value?.trim();
  if (latRaw !== '' && lngRaw !== '') {
    const lat = Number.parseFloat(latRaw);
    const lng = Number.parseFloat(lngRaw);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      payload.lat = lat;
      payload.lng = lng;
    }
  }

  if (!payload.name) {
    if (msg) msg.textContent = 'Business name is required.';
    return;
  }

  try {
    if (!currentBusiness) {
      const response = await fetch(`${API_BASE}/businesses`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create listing.');
      if (msg) msg.textContent = data.name ? `Saved: ${data.name}` : 'Saved.';
    } else {
      const response = await fetch(`${API_BASE}/businesses/${encodeURIComponent(currentBusiness.id)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update listing.');
      if (msg) msg.textContent = data.name ? `Updated: ${data.name}` : 'Updated.';
    }
    setGlobalMessage('', false);
    await loadMyBusiness();
  } catch (e) {
    if (msg) msg.textContent = e.message || 'Save failed.';
  }
}

async function submitMyPage(event) {
  event.preventDefault();
  const msg = document.getElementById('my-page-msg');
  if (!currentBusiness) return;

  const payload = {
    gallery_urls: textToUrlLines(document.getElementById('mp-gallery').value),
    website: document.getElementById('mp-website').value.trim(),
    phone: document.getElementById('mp-phone').value.trim(),
    contact_email: document.getElementById('mp-contact-email').value.trim(),
    allow_contact_email: document.getElementById('mp-allow-email').checked,
  };

  try {
    const response = await fetch(`${API_BASE}/businesses/${encodeURIComponent(currentBusiness.id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save.');
    if (msg) msg.textContent = 'Public page updated.';
    Object.assign(currentBusiness, data);
    fillOverview(currentBusiness);
    renderLivePreview();
    setGlobalMessage('', false);
  } catch (e) {
    if (msg) msg.textContent = e.message || 'Save failed.';
  }
}

function hideDealEditor() {
  const card = document.getElementById('deal-editor-card');
  const form = document.getElementById('deal-form');
  if (card) card.hidden = true;
  if (form) form.reset();
  const did = document.getElementById('deal-id');
  if (did) did.value = '';
  const msg = document.getElementById('deal-form-msg');
  if (msg) msg.textContent = '';
  syncOngoingToggle();
}

function syncOngoingToggle() {
  const ongoing = document.getElementById('deal-ongoing');
  const exp = document.getElementById('deal-expires');
  if (!ongoing || !exp) return;
  exp.disabled = ongoing.checked;
  if (ongoing.checked) exp.value = '';
}

function openDealEditor(deal) {
  const card = document.getElementById('deal-editor-card');
  const title = document.getElementById('deal-editor-title');
  if (card) card.hidden = false;
  if (title) title.textContent = deal ? 'Edit deal' : 'New deal';

  document.getElementById('deal-id').value = deal?.id || '';
  document.getElementById('deal-title').value = deal?.title || '';
  document.getElementById('deal-description').value = deal?.description || '';
  document.getElementById('deal-images').value = (deal?.image_urls || []).join('\n');
  document.getElementById('deal-valid-from').value = toDateInputValue(deal?.valid_from);
  document.getElementById('deal-ongoing').checked = !!deal?.no_end_date;
  document.getElementById('deal-expires').value = deal?.no_end_date ? '' : toDateInputValue(deal?.expires);
  document.getElementById('deal-student-only').checked =
    deal ? !!deal.student_only : true;
  syncOngoingToggle();
  card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderDealsGrid() {
  const grid = document.getElementById('deals-grid');
  if (!grid || !currentBusiness) return;

  const deals = dealsForCurrentBusiness();
  grid.innerHTML = '';

  deals.forEach((deal) => {
    const tile = document.createElement('article');
    tile.className = 'portal-deal-tile';
    const thumbUrl = (deal.image_urls || [])[0];
    const thumb = thumbUrl
      ? `<div class="portal-deal-thumb"><img src="${escapeHtml(thumbUrl)}" alt=""></div>`
      : `<div class="portal-deal-thumb portal-deal-thumb-empty">No photo</div>`;

    tile.innerHTML = `
      ${thumb}
      <div class="portal-deal-tile-body">
        <strong>${escapeHtml(deal.title || 'Deal')}</strong>
        <p class="small muted">${escapeHtml(formatDealDates(deal))}</p>
        <div class="portal-deal-tile-actions">
          <button type="button" class="btn btn-secondary btn-small portal-edit-deal" data-id="${escapeHtml(deal.id)}">Edit</button>
          <button type="button" class="btn btn-secondary btn-small portal-dup-deal" data-id="${escapeHtml(deal.id)}">Duplicate</button>
        </div>
      </div>
    `;
    grid.appendChild(tile);
  });

  grid.querySelectorAll('.portal-edit-deal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const deal = deals.find((d) => d.id === id);
      if (deal) openDealEditor(deal);
    });
  });

  grid.querySelectorAll('.portal-dup-deal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const deal = deals.find((d) => d.id === id);
      if (!deal) return;
      const clone = {
        ...deal,
        id: '',
        title: `${deal.title || 'Deal'} (copy)`,
      };
      openDealEditor(clone);
    });
  });
}

async function submitDealForm(event) {
  event.preventDefault();
  const msg = document.getElementById('deal-form-msg');
  if (!currentBusiness) return;

  const id = document.getElementById('deal-id').value.trim();
  const ongoing = document.getElementById('deal-ongoing').checked;
  const payload = {
    title: document.getElementById('deal-title').value.trim(),
    description: document.getElementById('deal-description').value.trim(),
    image_urls: textToUrlLines(document.getElementById('deal-images').value),
    valid_from: document.getElementById('deal-valid-from').value || '',
    expires: ongoing ? '' : document.getElementById('deal-expires').value || '',
    no_end_date: ongoing,
    student_only: document.getElementById('deal-student-only').checked,
    deal_type: 'Student Deal',
    business_id: currentBusiness.id,
    business_name: currentBusiness.name,
  };

  if (!payload.title) {
    if (msg) msg.textContent = 'Title is required.';
    return;
  }

  try {
    let resp;
    if (id) {
      resp = await fetch(`${API_BASE}/deals/${encodeURIComponent(id)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      resp = await fetch(`${API_BASE}/deals`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || 'Save failed.');
    if (msg) msg.textContent = id ? 'Deal updated.' : 'Deal created.';
    await refreshDealsCache();
    renderDealsGrid();
    renderLivePreview();
    hideDealEditor();
  } catch (e) {
    if (msg) msg.textContent = e.message || 'Save failed.';
  }
}

async function deleteCurrentDeal() {
  const msg = document.getElementById('deal-form-msg');
  const id = document.getElementById('deal-id').value.trim();
  if (!id) {
    if (msg) msg.textContent = 'Save the deal first before deleting.';
    return;
  }
  if (!window.confirm('Delete this deal permanently?')) return;

  try {
    const resp = await fetch(`${API_BASE}/deals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || 'Delete failed.');
    await refreshDealsCache();
    renderDealsGrid();
    renderLivePreview();
    hideDealEditor();
  } catch (e) {
    if (msg) msg.textContent = e.message || 'Delete failed.';
  }
}

function wireAddressAutocomplete() {
  const input = document.getElementById('settings-address');
  const list = document.getElementById('address-suggestions');
  const latEl = document.getElementById('settings-lat');
  const lngEl = document.getElementById('settings-lng');
  const hint = document.getElementById('address-geocode-hint');
  if (!input || !list) return;

  let timer = null;

  function hideList() {
    list.hidden = true;
    list.innerHTML = '';
    input.removeAttribute('aria-expanded');
  }

  function selectSuggestion(s) {
    suppressAddressGeocodeClear = true;
    input.value = (s.formatted_address || s.label || '').trim();
    if (latEl) latEl.value = String(s.lat);
    if (lngEl) lngEl.value = String(s.lng);
    suppressAddressGeocodeClear = false;
    hideList();
    if (hint) {
      hint.textContent =
        'Coordinates saved with this address — Explore map will pin this location (pick again if you change text manually).';
    }
  }

  input.addEventListener('input', () => {
    if (!suppressAddressGeocodeClear) {
      if (latEl) latEl.value = '';
      if (lngEl) lngEl.value = '';
      if (hint) {
        hint.textContent =
          'Pick an address from suggestions after typing — coordinates reset until you choose again.';
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
    window.setTimeout(() => hideList(), 180);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireBusinessAuth();
  if (!user) return;

  bindNavigation();
  wireAddressAutocomplete();

  document.getElementById('settings-form')?.addEventListener('submit', submitSettings);
  document.getElementById('my-page-form')?.addEventListener('submit', submitMyPage);
  document.getElementById('deal-form')?.addEventListener('submit', submitDealForm);

  document.getElementById('deal-new-btn')?.addEventListener('click', () => openDealEditor(null));
  document.getElementById('deal-cancel-btn')?.addEventListener('click', hideDealEditor);
  document.getElementById('deal-delete-btn')?.addEventListener('click', deleteCurrentDeal);

  document.getElementById('deal-ongoing')?.addEventListener('change', syncOngoingToggle);

  document.getElementById('deal-duplicate-btn')?.addEventListener('click', () => {
    const title = document.getElementById('deal-title').value.trim();
    document.getElementById('deal-id').value = '';
    document.getElementById('deal-title').value = title ? `${title} (copy)` : 'New deal (copy)';
    document.getElementById('deal-editor-title').textContent = 'Duplicate deal';
    document.getElementById('deal-form-msg').textContent = 'Review fields, then Save to publish a new post.';
  });

  await loadMyBusiness();
});
