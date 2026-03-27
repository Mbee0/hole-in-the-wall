const API_BASE = window.getApiBase();

function byId(id) {
  return document.getElementById(id);
}

function normalizeList(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
}

function titleCaseWord(s) {
  return (s || '').charAt(0).toUpperCase() + (s || '').slice(1);
}

function buildOfferChips(offerTypes, dealFocus) {
  const offers = normalizeList(offerTypes).map((x) => `Offer: ${titleCaseWord(x)}`);
  const focus = normalizeList(dealFocus).map((x) => `Deal: ${titleCaseWord(x)}`);
  return [...offers, ...focus];
}

function renderDeals(deals, fallbackSummary) {
  const host = byId('business-deals');
  if (!host) return;
  host.innerHTML = '';

  if (!deals.length) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<strong>${fallbackSummary || 'No active deals listed yet.'}</strong>`;
    host.appendChild(card);
    return;
  }

  deals.forEach((deal) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${deal.title || 'Deal'}</strong>
      <p class="small">${deal.description || ''}</p>
    `;
    host.appendChild(card);
  });
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const businessId = params.get('id');

  if (!businessId) {
    byId('business-story').textContent = 'No business selected. Go back to Explore and choose a listing.';
    return;
  }

  try {
    const [bizResp, dealsResp] = await Promise.all([
      fetch(`${API_BASE}/businesses/${encodeURIComponent(businessId)}`),
      fetch(`${API_BASE}/deals`),
    ]);

    if (!bizResp.ok) {
      byId('business-story').textContent = 'Business not found.';
      return;
    }

    const business = await bizResp.json();
    const allDeals = dealsResp.ok ? await dealsResp.json() : [];
    const dealsForBusiness = (allDeals || []).filter(
      (d) => (d.business_name || '').toLowerCase() === (business.name || '').toLowerCase()
    );

    byId('business-name').textContent = business.name || 'Business details';
    byId('business-story').textContent = business.story || 'No story available yet.';
    byId('business-address').textContent = business.address || 'Not provided';
    byId('business-category').textContent = business.category || 'Not provided';
    byId('business-claimed').textContent = business.claimed ? 'Yes' : 'No';

    const meta = byId('business-meta');
    if (meta) {
      meta.innerHTML = '';
      const chips = [
        business.claimed ? 'Claimed' : 'Unclaimed',
        business.category || 'Uncategorized',
      ];
      chips.forEach((label) => {
        const chip = document.createElement('span');
        chip.className = 'filter-chip';
        chip.textContent = label;
        meta.appendChild(chip);
      });
    }

    renderDeals(dealsForBusiness, business.deal_summary);

    const offersHost = byId('business-offers');
    if (offersHost) {
      offersHost.innerHTML = '';
      const offerChips = buildOfferChips(business.offer_types, business.deal_focus);
      if (!offerChips.length) {
        offersHost.innerHTML = '<span class="small">No offer options listed yet.</span>';
      } else {
        offerChips.forEach((label) => {
          const chip = document.createElement('span');
          chip.className = 'filter-chip';
          chip.textContent = label;
          offersHost.appendChild(chip);
        });
      }
    }
  } catch {
    byId('business-story').textContent = 'Could not load business information.';
  }
}

document.addEventListener('DOMContentLoaded', init);


