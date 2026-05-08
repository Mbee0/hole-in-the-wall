const API_BASE = window.getApiBase();

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

function setSendStatus(visible, state, text) {
  const screen = document.getElementById('student-send-status');
  const icon = document.getElementById('student-send-icon');
  const label = document.getElementById('student-send-text');
  if (!screen || !icon || !label) return;

  if (!visible) {
    screen.classList.remove('active');
    return;
  }

  screen.classList.add('active');
  icon.classList.remove('sending', 'sent');
  if (state === 'sent') {
    icon.classList.add('sent');
    icon.textContent = '✓';
  } else {
    icon.classList.add('sending');
    icon.textContent = '...';
  }
  label.textContent = text || '';
}

function setCardMode(mode) {
  const signupCard = document.getElementById('student-signup-card');
  const waitingCard = document.getElementById('student-waiting-card');
  if (!signupCard || !waitingCard) return;
  if (mode === 'waiting') {
    signupCard.style.display = 'none';
    waitingCard.style.display = '';
  } else {
    signupCard.style.display = '';
    waitingCard.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('student-email');
  const codeInput = document.getElementById('student-code');
  const sendCodeBtn = document.getElementById('student-send-code');
  const codeContinueBtn = document.getElementById('student-code-continue');
  const createBtn = document.getElementById('student-create-account');
  const signInNowBtn = document.getElementById('student-signin-now');
  const backBtn = document.getElementById('student-back-to-signup');
  const campusInput = document.getElementById('campus-name');
  const schoolList = document.getElementById('school-list');

  let storedEmail = '';
  let storedCode = '';

  // Populate campus autocomplete list from shared directory (if present).
  if (schoolList && window.SchoolDirectory?.allSchoolDisplayNames) {
    const names = window.SchoolDirectory.allSchoolDisplayNames();
    schoolList.innerHTML = names.map((n) => `<option value="${n}"></option>`).join('');
  }

  function maybeAutofillCampusFromEmail(email) {
    if (!campusInput) return;
    if (!window.SchoolDirectory?.inferSchoolFromEmail) return;
    const inferred = window.SchoolDirectory.inferSchoolFromEmail(email);
    if (!inferred?.name) return;
    // Only autofill if user hasn't typed a campus yet.
    if ((campusInput.value || '').trim()) return;
    campusInput.value = inferred.name;
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      setCardMode('signup');
      if (signInNowBtn) signInNowBtn.style.display = 'none';
      setMessage('');
    });
  }

  if (emailInput) {
    emailInput.addEventListener('input', () => {
      maybeAutofillCampusFromEmail(emailInput.value);
    });
    emailInput.addEventListener('blur', () => {
      maybeAutofillCampusFromEmail(emailInput.value);
    });
  }

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

      maybeAutofillCampusFromEmail(email);

      sendCodeBtn.disabled = true;
      setMessage('');
      if (signInNowBtn) signInNowBtn.style.display = 'none';
      setCardMode('waiting');
      setSendStatus(true, 'sending', 'Sending verification code...');

      try {
        const response = await fetch(`${API_BASE}/auth/student/verify/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (!response.ok) {
          const message = data.error || 'Could not send verification code.';
          const existing = response.status === 409 || message.toLowerCase().includes('already exists');
          if (existing) {
            setSendStatus(true, 'sent', 'This account already exists.');
            if (signInNowBtn) signInNowBtn.style.display = '';
          } else {
            setCardMode('signup');
            setSendStatus(false);
            setMessage(message);
          }
          return;
        }

        storedEmail = email;
        setSendStatus(true, 'sent', 'Verification code sent. Check your email.');
        setTimeout(() => {
          setCardMode('signup');
          showStep('step-code');
          setMessage('');
        }, 900);
      } catch {
        setCardMode('signup');
        setMessage('Backend not running yet.');
        setSendStatus(false);
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

        // If campus name is blank, infer from email domain.
        if (!preferences.campus_name && window.SchoolDirectory?.inferSchoolFromEmail) {
          const inferred = window.SchoolDirectory.inferSchoolFromEmail(storedEmail);
          if (inferred?.name) preferences.campus_name = inferred.name;
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


