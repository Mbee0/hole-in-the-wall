const API_BASE = window.getApiBase();

function setMessage(text) {
  const el = document.getElementById('reset-message');
  if (el) el.textContent = text || '';
}

function setSendStatus(visible, state, text) {
  const screen = document.getElementById('reset-send-status');
  const icon = document.getElementById('reset-send-icon');
  const label = document.getElementById('reset-send-text');
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

document.addEventListener('DOMContentLoaded', () => {
  const sendBtn = document.getElementById('send-reset-code');
  const form = document.getElementById('reset-form');

  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const email = document.getElementById('reset-email').value.trim();
      const confirmStep = document.getElementById('reset-step-confirm');
      if (!email) {
        setMessage('Please enter your email first.');
        return;
      }
      sendBtn.disabled = true;
      setMessage('');
      setSendStatus(true, 'sending', 'Sending reset code...');
      try {
        const response = await fetch(`${API_BASE}/auth/password/reset/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error || 'Failed to send reset code.');
          setSendStatus(false);
          return;
        }
        setSendStatus(true, 'sent', 'Reset code sent. Check your email.');
        setTimeout(() => {
          setSendStatus(false);
          if (confirmStep) confirmStep.style.display = 'block';
        }, 900);
      } catch {
        setMessage('Backend not running yet.');
        setSendStatus(false);
      } finally {
        sendBtn.disabled = false;
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('reset-email').value.trim();
      const code = document.getElementById('reset-code').value.trim();
      const newPassword = document.getElementById('new-password').value;

      try {
        const response = await fetch(`${API_BASE}/auth/password/reset/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            code,
            new_password: newPassword,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error || 'Could not reset password.');
          return;
        }
        setMessage(data.message || 'Password reset successful.');
      } catch {
        setMessage('Backend not running yet.');
      }
    });
  }
});


