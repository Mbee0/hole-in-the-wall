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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDealDates(deal) {
  if (deal.no_end_date) {
    const start = deal.valid_from ? `From ${deal.valid_from}` : '';
    return start ? `${start} · Ongoing` : 'Ongoing';
  }
  const parts = [];
  if (deal.valid_from) parts.push(`Starts ${deal.valid_from}`);
  if (deal.expires) parts.push(`Ends ${deal.expires}`);
  return parts.length ? parts.join(' · ') : '';
}

function buildOfferChips(offerTypes, dealFocus) {
  const offers = normalizeList(offerTypes).map((x) => `Offer: ${titleCaseWord(x)}`);
  const focus = normalizeList(dealFocus).map((x) => `Deal: ${titleCaseWord(x)}`);
  return [...offers, ...focus];
}

function dealsMatchingBusiness(business, allDeals) {
  const bid = String(business.id || '');
  const name = (business.name || '').toLowerCase().trim();
  return (allDeals || []).filter((d) => {
    const dbid = String(d.business_id || '');
    if (bid && dbid === bid) return true;
    return (d.business_name || '').toLowerCase().trim() === name;
  });
}

function renderHero(business) {
  const host = byId('business-hero');
  if (!host) return;
  const urls = normalizeList(business.gallery_urls);
  host.innerHTML = '';

  if (!urls.length) {
    host.className = 'business-hero business-hero-empty';
    host.textContent = 'Photos coming soon';
    return;
  }

  host.className = 'business-hero';
  const primary = document.createElement('div');
  primary.className = 'business-hero-main';
  const img = document.createElement('img');
  img.src = urls[0];
  img.alt = `${business.name || 'Restaurant'} photo`;
  primary.appendChild(img);
  host.appendChild(primary);

  if (urls.length > 1) {
    const strip = document.createElement('div');
    strip.className = 'business-hero-strip';
    urls.slice(1, 8).forEach((url) => {
      const wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = 'business-hero-thumb';
      wrap.setAttribute('aria-label', 'Show photo');
      const ti = document.createElement('img');
      ti.src = url;
      ti.alt = '';
      wrap.appendChild(ti);
      wrap.addEventListener('click', () => {
        img.src = url;
      });
      strip.appendChild(wrap);
    });
    host.appendChild(strip);
  }
}

function renderDeals(deals, fallbackSummary) {
  const host = byId('business-deals');
  if (!host) return;
  host.innerHTML = '';

  if (!deals.length) {
    const card = document.createElement('div');
    card.className = 'card biz-deal-card';
    card.innerHTML = `<strong>${escapeHtml(fallbackSummary || 'No active deals listed yet.')}</strong>`;
    host.appendChild(card);
    return;
  }

  deals.forEach((deal) => {
    const card = document.createElement('div');
    card.className = 'card biz-deal-card';
    const imgs = normalizeList(deal.image_urls);
    const thumb =
      imgs[0] &&
      `<div class="biz-deal-media"><img src="${escapeHtml(imgs[0])}" alt=""></div>`;
    const dates = formatDealDates(deal);
    card.innerHTML = `
      ${thumb || ''}
      <div class="biz-deal-body">
        <strong>${escapeHtml(deal.title || 'Deal')}</strong>
        <p class="small">${escapeHtml(deal.description || '')}</p>
        ${dates ? `<p class="small biz-deal-dates">${escapeHtml(dates)}</p>` : ''}
      </div>
    `;
    host.appendChild(card);
  });
}

function wireContactSidebar(business) {
  const webWrap = byId('business-website-wrap');
  const web = byId('business-website');
  const phoneWrap = byId('business-phone-wrap');
  const phone = byId('business-phone');
  const emailWrap = byId('business-email-wrap');
  const email = byId('business-email');

  const site = (business.website || '').trim();
  if (site && webWrap && web) {
    webWrap.hidden = false;
    web.href = site.startsWith('http') ? site : `https://${site}`;
    web.textContent = site.replace(/^https?:\/\//i, '');
  } else if (webWrap) webWrap.hidden = true;

  const tel = (business.phone || '').trim();
  if (tel && phoneWrap && phone) {
    phoneWrap.hidden = false;
    phone.textContent = tel;
    phone.href = `tel:${tel.replace(/[^\d+]/g, '')}`;
  } else if (phoneWrap) phoneWrap.hidden = true;

  const em = (business.contact_email || '').trim();
  const allow = !!business.allow_contact_email;
  if (allow && em && emailWrap && email) {
    emailWrap.hidden = false;
    email.href = `mailto:${encodeURIComponent(em)}`;
    email.textContent = em;
  } else if (emailWrap) emailWrap.hidden = true;
}

function wireBackLink() {
  const back = byId('back-to-explore');
  if (!back) return;
  back.addEventListener('click', (e) => {
    const ref = document.referrer || '';
    if (window.history.length > 1 && ref.includes('/explore')) {
      e.preventDefault();
      window.history.back();
    }
  });
}

function wireShareButton() {
  const btn = byId('share-business-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      btn.textContent = 'Link copied!';
      window.setTimeout(() => {
        btn.textContent = 'Share page';
      }, 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  });
}

async function init() {
  wireBackLink();
  wireShareButton();

  const storyEl = byId('business-story');
  const apiBase = typeof window.getApiBase === 'function' ? window.getApiBase() : '';
  if (storyEl) {
    storyEl.textContent = apiBase
      ? 'Loading business information...'
      : 'Could not determine API base URL (api-config.js not loaded).';
  }

  const params = new URLSearchParams(window.location.search);
  const businessId = params.get('id');

  if (!businessId) {
    if (storyEl) storyEl.textContent = 'No business selected. Go back to Explore and choose a listing.';
    return;
  }

  try {
    const [bizResp, dealsResp] = await Promise.all([
      fetch(`${apiBase}/businesses/${encodeURIComponent(businessId)}`),
      fetch(`${apiBase}/deals`),
    ]);

    if (!bizResp.ok) {
      if (storyEl) storyEl.textContent = `Business not found (status ${bizResp.status}).`;
      return;
    }

    const business = await bizResp.json();
    const allDeals = dealsResp.ok ? await dealsResp.json() : [];
    const dealsForBusiness = dealsMatchingBusiness(business, allDeals);

    renderHero(business);

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
    wireContactSidebar(business);

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

    if (typeof window.syncBusinessDetailNav === 'function') {
      window.syncBusinessDetailNav();
    }
  } catch (err) {
    if (storyEl) storyEl.textContent = `Could not load business information. (${err?.message || 'network error'})`;
  }
}

document.addEventListener('DOMContentLoaded', init);
