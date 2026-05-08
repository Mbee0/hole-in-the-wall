const EXPLORE_API_BASE = window.getApiBase();

let map;
let allBusinesses = [];
let allDeals = [];
let activeMarkers = [];
let studentCenter = null;
let currentUser = null;
let savedDealIds = new Set();
const selectedPrograms = new Set();
const selectedSubtypes = new Set();

function setExploreNavForAuth(user) {
  const studentLink = document.getElementById('student-dashboard-link');
  const businessLink = document.getElementById('restaurant-portal-link');
  const signInLink = document.getElementById('sign-in-link');
  const profileLink = document.getElementById('profile-link');

  if (studentLink) studentLink.style.display = 'none';
  if (businessLink) businessLink.style.display = 'none';
  if (profileLink) profileLink.style.display = 'none';
  if (signInLink) signInLink.style.display = '';

  if (!user) return;
  if (user.account_type === 'consumer' && studentLink) studentLink.style.display = '';
  if (user.account_type === 'business' && businessLink) businessLink.style.display = '';
  if (profileLink) profileLink.style.display = '';
  if (signInLink) signInLink.style.display = 'none';
}

async function syncExploreAuthNav() {
  try {
    const response = await fetch(`${EXPLORE_API_BASE}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    currentUser = data?.user || null;
    setExploreNavForAuth(currentUser);
  } catch {
    // Keep public-state nav if auth check fails.
    currentUser = null;
  }
}

const CATEGORY_COLORS = {
  bakery: '#d97706', // amber
  cafe: '#0f766e', // teal
  'late night': '#7c3aed', // violet
  restaurant: '#b91c1c', // red
  catering: '#0369a1', // sky
};

function colorForCategory(category) {
  const key = (category || '').toLowerCase().trim();
  return CATEGORY_COLORS[key] || '#8b5b4c'; // default brand brown
}

function createCategoryIcon(category) {
  const color = colorForCategory(category);
  return L.divIcon({
    className: 'custom-pin-wrapper',
    html: `<span class="custom-pin" style="background:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
    popupAnchor: [0, -16],
  });
}

function clearMarkers() {
  activeMarkers.forEach((marker) => map.removeLayer(marker));
  activeMarkers = [];
}

function getDealForBusiness(businessName, fallbackSummary) {
  const match = allDeals.find((d) => (d.business_name || '').toLowerCase() === (businessName || '').toLowerCase());
  return match?.title || fallbackSummary || 'No active deal posted yet';
}

function getDealObjectForBusiness(business) {
  if (!business) return null;
  const bizId = (business.id || '').toString();
  if (bizId) {
    const byId = allDeals.find((d) => (d.business_id || '').toString() === bizId);
    if (byId) return byId;
  }
  const bizName = (business.name || '').toLowerCase().trim();
  if (bizName) {
    const byName = allDeals.find((d) => (d.business_name || '').toLowerCase().trim() === bizName);
    if (byName) return byName;
  }
  return null;
}

async function refreshSavedDealIds() {
  savedDealIds = new Set();
  if (!currentUser || currentUser.account_type !== 'consumer') return;
  try {
    const resp = await fetch(`${EXPLORE_API_BASE}/customer/saved-deals`, { credentials: 'include' });
    const data = await resp.json();
    const deals = data?.saved_deals || [];
    deals.forEach((d) => {
      if (d?.id) savedDealIds.add(d.id);
    });
  } catch {
    // Non-fatal on explore.
  }
}

async function saveDealFromExplore(dealId) {
  if (!dealId) return;
  try {
    const resp = await fetch(`${EXPLORE_API_BASE}/customer/save-deal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ deal_id: dealId }),
    });
    if (resp.status === 401 || resp.status === 403) {
      window.location.href = 'login.html';
      return;
    }
    if (!resp.ok) {
      let msg = 'Failed to save deal.';
      try {
        const data = await resp.json();
        msg = data?.error || msg;
      } catch {}
      alert(msg);
      return;
    }
    savedDealIds.add(dealId);
    applyCategoryFilter();
  } catch {
    alert('Could not reach backend to save deal.');
  }
}

async function unsaveDealFromExplore(dealId) {
  if (!dealId) return;
  try {
    const resp = await fetch(`${EXPLORE_API_BASE}/customer/unsave-deal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ deal_id: dealId }),
    });
    if (resp.status === 401 || resp.status === 403) {
      window.location.href = 'login.html';
      return;
    }
    if (!resp.ok) {
      let msg = 'Failed to unsave deal.';
      try {
        const data = await resp.json();
        msg = data?.error || msg;
      } catch {}
      alert(msg);
      return;
    }
    savedDealIds.delete(dealId);
    applyCategoryFilter();
  } catch {
    alert('Could not reach backend to unsave deal.');
  }
}

async function toggleSavedDeal(dealId) {
  if (!dealId) return;
  if (savedDealIds.has(dealId)) {
    await unsaveDealFromExplore(dealId);
  } else {
    await saveDealFromExplore(dealId);
  }
}

function normalizedList(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x) => typeof x === 'string')
    .map((x) => x.toLowerCase().trim());
}

function intersects(a, bSet) {
  if (!bSet.size) return true;
  return a.some((x) => bSet.has(x));
}

function businessMatchesProgramFilters(business) {
  const offerTypes = normalizedList(business.offer_types);
  const fallbackOfferTypes = offerTypes.length
    ? offerTypes
    : (business.deal_summary ? ['deals'] : []);
  return intersects(fallbackOfferTypes, selectedPrograms);
}

function businessMatchesSubtypeFilters(business) {
  const dealFocus = normalizedList(business.deal_focus);
  const fallbackDealFocus = dealFocus.length ? dealFocus : ['meals'];
  return intersects(fallbackDealFocus, selectedSubtypes);
}

function normalizeCampusName(name) {
  return (name || '').trim().toLowerCase();
}

function centerForCampusName(campusName) {
  const normalized = normalizeCampusName(campusName);
  if (!normalized) return null;

  // Starter mapping for common SoCal campuses; easy to extend.
  const schoolCenters = {
    ucla: [34.0689, -118.4452],
    'university of california los angeles': [34.0689, -118.4452],
    usc: [34.0224, -118.2851],
    'university of southern california': [34.0224, -118.2851],
    uci: [33.6405, -117.8443],
    'university of california irvine': [33.6405, -117.8443],
    ucsd: [32.8801, -117.2340],
    'university of california san diego': [32.8801, -117.2340],
    sdsu: [32.7757, -117.0719],
    'san diego state university': [32.7757, -117.0719],
    csuf: [33.8823, -117.8850],
    'cal state fullerton': [33.8823, -117.8850],
    'california state university fullerton': [33.8823, -117.8850],
    csulb: [33.7838, -118.1141],
    'cal state long beach': [33.7838, -118.1141],
    'california state university long beach': [33.7838, -118.1141],
  };

  if (schoolCenters[normalized]) return schoolCenters[normalized];

  // Best-effort fuzzy match.
  for (const [key, coords] of Object.entries(schoolCenters)) {
    if (normalized.includes(key) || key.includes(normalized)) return coords;
  }
  return null;
}

async function tryLoadStudentCenter() {
  try {
    const meResponse = await fetch(`${EXPLORE_API_BASE}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });
    const meData = await meResponse.json();
    if (!meData?.user || meData.user.account_type !== 'consumer') return null;

    const prefResponse = await fetch(`${EXPLORE_API_BASE}/customer/preferences`, {
      method: 'GET',
      credentials: 'include',
    });
    const prefData = await prefResponse.json();
    const campusName = prefData?.preferences?.campus_name || '';
    return centerForCampusName(campusName);
  } catch {
    return null;
  }
}

function renderResults(items) {
  const list = document.getElementById('results-list');
  if (!list || !map) return;

  list.innerHTML = '';
  clearMarkers();

  if (!items.length) {
    list.innerHTML = '<p class="helper">No businesses found for this filter.</p>';
    return;
  }

  items.forEach((item) => {
    const dealText = getDealForBusiness(item.name, item.deal_summary);
    const dealObj = getDealObjectForBusiness(item);
    const isConsumer = currentUser?.account_type === 'consumer';
    const hasDeal = !!dealObj;
    const canSave = hasDeal && isConsumer;
    const isSaved = hasDeal && savedDealIds.has(dealObj.id);
    const card = document.createElement('div');
    card.className = 'result-card is-clickable';
    const bookmarkSvg = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 3h10a2 2 0 0 1 2 2v16l-7-4-7 4V5a2 2 0 0 1 2-2z" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    `;
    card.innerHTML = `
      <div class="card-top">
        <h3>${item.name || 'Business'}</h3>
        ${hasDeal ? `
          ${
            isConsumer
              ? `<button class="save-bookmark ${isSaved ? 'is-saved' : ''}" data-action="toggle-save" title="${isSaved ? 'Saved' : 'Save deal'}" aria-label="${isSaved ? 'Saved' : 'Save deal'}">
                  ${bookmarkSvg}
                </button>`
              : `<a class="save-bookmark" href="login.html" title="Sign in to save">
                  ${bookmarkSvg}
                </a>`
          }
        ` : ''}
      </div>
      <div class="meta">
        <span>${item.category || 'Uncategorized'}</span>
        <span>${item.address || 'Address unavailable'}</span>
      </div>
      <div>${dealText}</div>
      <div class="meta">
        <span class="filter-chip">${item.claimed ? 'Claimed' : 'Unclaimed'}</span>
      </div>
    `;
    if (item.id) {
      card.addEventListener('click', () => {
        window.location.href = `business.html?id=${encodeURIComponent(item.id)}`;
      });
    }

    if (canSave) {
      const btn = card.querySelector('[data-action="toggle-save"]');
      if (btn) {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await toggleSavedDeal(dealObj.id);
        });
      }
    }
    list.appendChild(card);

    if (typeof item.lat === 'number' && typeof item.lng === 'number') {
      const marker = L.marker([item.lat, item.lng], {
        icon: createCategoryIcon(item.category),
        title: `${item.name || 'Business'} - ${dealText}`,
      }).addTo(map);

      marker.bindPopup(`<strong>${item.name || 'Business'}</strong><br/>${dealText}`);
      card.addEventListener('mouseenter', () => marker.openPopup());
      activeMarkers.push(marker);
    }
  });

  const inBounds = items.filter((b) => typeof b.lat === 'number' && typeof b.lng === 'number');
  if (inBounds.length) {
    if (studentCenter) {
      map.setView(studentCenter, 13);
    } else {
      const bounds = L.latLngBounds(inBounds.map((b) => [b.lat, b.lng]));
      map.fitBounds(bounds);
    }
  } else if (studentCenter) {
    map.setView(studentCenter, 13);
  }
}

async function loadData() {
  const [businessResponse, dealsResponse] = await Promise.all([
    fetch(`${EXPLORE_API_BASE}/businesses`),
    fetch(`${EXPLORE_API_BASE}/deals`),
  ]);

  allBusinesses = await businessResponse.json();
  allDeals = await dealsResponse.json();
}

function applyCategoryFilter() {
  const categoryEl = document.getElementById('category-filter');
  const selected = categoryEl?.value || 'All';
  const categoryFiltered =
    selected === 'All'
      ? allBusinesses
      : allBusinesses.filter((b) => (b.category || '').toLowerCase() === selected.toLowerCase());

  const filtered = categoryFiltered
    .filter((b) => businessMatchesProgramFilters(b))
    .filter((b) => businessMatchesSubtypeFilters(b));

  renderResults(filtered);
}

function bindFilterChips() {
  const chips = Array.from(document.querySelectorAll('[data-filter-group][data-filter-value]'));
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const group = chip.dataset.filterGroup;
      const value = (chip.dataset.filterValue || '').toLowerCase().trim();
      if (!group || !value) return;

      const targetSet = group === 'program' ? selectedPrograms : selectedSubtypes;
      if (targetSet.has(value)) {
        targetSet.delete(value);
        chip.classList.remove('is-active');
      } else {
        targetSet.add(value);
        chip.classList.add('is-active');
      }

      applyCategoryFilter();
    });
  });
}

async function initMap() {
  if (typeof L === 'undefined') {
    const list = document.getElementById('results-list');
    if (list) list.innerHTML = '<p class="helper">Map library failed to load. Refresh page.</p>';
    return;
  }

  studentCenter = await tryLoadStudentCenter();
  const defaultCenter = studentCenter || [34.0522, -118.2437];
  const defaultZoom = studentCenter ? 13 : 11;

  map = L.map('map').setView(defaultCenter, defaultZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const list = document.getElementById('results-list');
  try {
    await loadData();
    await refreshSavedDealIds();
    applyCategoryFilter();
  } catch (err) {
    if (list) list.innerHTML = '<p class="helper">Could not load map businesses from backend.</p>';
  }

  const category = document.getElementById('category-filter');
  if (category) {
    category.addEventListener('change', applyCategoryFilter);
  }
  bindFilterChips();
}

document.addEventListener('DOMContentLoaded', async () => {
  await syncExploreAuthNav();
  await initMap();
});

