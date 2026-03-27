const API_BASE = `http://${window.location.hostname}:5000/api`;

function setMessage(text) {
  const el = document.getElementById('auth-message');
  if (!el) return;
  el.textContent = text || '';
}

function readSelectedCategories() {
  return Array.from(document.querySelectorAll('.pref-category:checked')).map((cb) => cb.value);
}

function showStep(stepName) {
  const steps = ['step-email', 'step-code', 'step-profile'];
  steps.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = id === stepName ? 'block' : 'none';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('student-email');
  const codeInput = document.getElementById('student-code');
  const sendCodeBtn = document.getElementById('student-send-code');
  const codeContinueBtn = document.getElementById('student-code-continue');
  const createBtn = document.getElementById('student-create-account');

  let storedEmail = '';
  let storedCode = '';

  if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!email) {
        setMessage('Please enter your .edu email.');
        return;
      }
      if (!email.endsWith('.edu')) {
        setMessage('Please use a .edu email.');
        return;
      }

      sendCodeBtn.disabled = true;
      setMessage('Sending verification code...');

      try {
        const response = await fetch(`${API_BASE}/auth/student/verify/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error || 'Could not send verification code.');
          sendCodeBtn.disabled = false;
          return;
        }

        storedEmail = email;
        showStep('step-code');
        setMessage('Verification code sent. Check your email.');
      } catch {
        setMessage('Backend not running yet.');
      } finally {
        sendCodeBtn.disabled = false;
      }
    });
  }

  if (codeContinueBtn) {
    codeContinueBtn.addEventListener('click', () => {
      const code = codeInput.value.trim();
      if (!/^\d{6}$/.test(code)) {
        setMessage('Please enter a valid 6-digit code.');
        return;
      }
      storedCode = code;
      showStep('step-profile');
      setMessage('');
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      try {
        const name = document.getElementById('student-name').value.trim();
        const password = document.getElementById('student-password').value;
        const campusName = document.getElementById('campus-name').value.trim();
        const notes = document.getElementById('preference-notes').value.trim();
        const preferences = {
          campus_name: campusName,
          preferred_categories: readSelectedCategories(),
          notes
        };

        if (!name) {
          setMessage('Please enter your name.');
          return;
        }
        if (!password) {
          setMessage('Please create a password.');
          return;
        }
        if (!storedEmail) {
          setMessage('Missing email.');
          return;
        }
        if (!storedCode) {
          setMessage('Missing verification code.');
          return;
        }

        const response = await fetch(`${API_BASE}/auth/student/verify/confirm`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: storedEmail,
            code: storedCode,
            name,
            password,
            preferences
          })
        });

        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error || 'Failed to create account.');
          return;
        }

        window.location.href = 'customer.html';
      } catch {
        setMessage('Backend not running yet.');
      }
    });
  }
});

