const sampleBusinesses = [
  {
    name: 'Maple Crumb Bakery',
    category: 'Bakery',
    address: '12 College Ave',
    deal: 'Buy 1 pastry, get 1 half off after 3 PM',
    claimed: true,
    x: '28%',
    y: '36%'
  },
  {
    name: 'Midnight Noodles',
    category: 'Late Night',
    address: '85 Union Street',
    deal: '15% off student combo meals',
    claimed: false,
    x: '58%',
    y: '52%'
  },
  {
    name: 'Green Table Cafe',
    category: 'Cafe',
    address: '220 Main St',
    deal: 'Club catering trays available',
    claimed: true,
    x: '70%',
    y: '25%'
  }
];

function renderResults(items) {
  const list = document.getElementById('results-list');
  const map = document.getElementById('map-layer');
  if (!list || !map) return;

  list.innerHTML = '';
  map.innerHTML = '<div class="fake-map"></div>';

  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <h3>${item.name}</h3>
      <div class="meta">
        <span>${item.category}</span>
        <span>${item.address}</span>
      </div>
      <div>${item.deal}</div>
      <div class="meta">
        <span class="filter-chip">${item.claimed ? 'Claimed' : 'Unclaimed'}</span>
        <a href="business.html" class="btn btn-secondary">View details</a>
      </div>
    `;
    card.addEventListener('mouseenter', () => {
      document.querySelectorAll('.pin').forEach(pin => pin.classList.remove('active'));
      const activePin = document.querySelector(`[data-pin="${index}"]`);
      if (activePin) activePin.classList.add('active');
    });
    list.appendChild(card);

    const pin = document.createElement('div');
    pin.className = 'pin';
    pin.dataset.pin = index;
    pin.style.left = item.x;
    pin.style.top = item.y;
    pin.title = `${item.name} - ${item.deal}`;
    map.appendChild(pin);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderResults(sampleBusinesses);

  const category = document.getElementById('category-filter');
  if (category) {
    category.addEventListener('change', event => {
      const value = event.target.value;
      const filtered = value === 'All'
        ? sampleBusinesses
        : sampleBusinesses.filter(item => item.category === value);
      renderResults(filtered);
    });
  }
});
