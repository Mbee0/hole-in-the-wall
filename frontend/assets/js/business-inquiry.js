const API_BASE = `http://${window.location.hostname}:5000/api`;

function setMessage(text) {
  const el = document.getElementById('auth-message');
  if (!el) return;
  el.textContent = text || '';
}

function getDealTypes() {
  return Array.from(document.querySelectorAll('.deal-type:checked')).map((cb) => cb.value);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('business-inquiry-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const email = document.getElementById('biz-email').value.trim();
      const phone_number = document.getElementById('biz-phone').value.trim();
      const inquirer_name = document.getElementById('inquirer-name').value.trim();
      const business_name = document.getElementById('business-name').value.trim();
      const blurb = document.getElementById('biz-blurb').value.trim();
      const deal_types = getDealTypes();

      const response = await fetch(`${API_BASE}/business-inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone_number,
          inquirer_name,
          business_name,
          deal_types,
          blurb,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || 'Failed to submit inquiry');
        return;
      }

      setMessage(data.message || 'Inquiry submitted.');
    } catch {
      setMessage('Backend not running yet.');
    }
  });
});

