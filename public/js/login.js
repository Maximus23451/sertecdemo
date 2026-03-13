// login.js
const existing = API.getUser();
if (existing) {
  if (existing.role === 'qa') location.href = '/qa.html';
  else if (existing.role === 'management') location.href = '/management.html';
}

async function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const err      = document.getElementById('errorMsg');
  const btn      = document.getElementById('loginBtn');
  const btnText  = document.getElementById('btnText');

  err.textContent = '';
  if (!username || !password) { err.textContent = 'Please fill in all fields.'; return; }

  btn.disabled = true;
  btnText.textContent = 'Signing in…';

  try {
    const user = await API.login(username, password);

    if (user.role === 'operator') {
      err.textContent = 'Use RFID login for operator accounts.';
      btn.disabled = false; btnText.textContent = 'Sign In';
      return;
    }

    API.setUser(user);
    if (user.role === 'qa')         location.href = '/qa.html';
    else if (user.role === 'management') location.href = '/management.html';
    else { err.textContent = 'Unknown role.'; btn.disabled = false; btnText.textContent = 'Sign In'; }
  } catch (e) {
    err.textContent = e.message || 'Login failed.';
    btn.disabled = false;
    btnText.textContent = 'Sign In';
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
