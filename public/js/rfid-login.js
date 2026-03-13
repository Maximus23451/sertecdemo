// rfid-login.js
let rfidDone = false, swipeDone = false, swipeInited = false;

function handleRFID() {
  const sel = document.getElementById('operatorSelect').value;
  if (!sel) {
    document.getElementById('rfidStatus').className = 'rfid-status err';
    document.getElementById('rfidStatus').textContent = 'Please select an operator first';
    return;
  }
  if (rfidDone) return;
  const btn = document.getElementById('rfidBtn'), status = document.getElementById('rfidStatus');
  btn.classList.remove('success', 'error'); btn.classList.add('scanning');
  status.className = 'rfid-status active'; status.textContent = 'Scanning…';
  setTimeout(() => {
    btn.classList.remove('scanning'); btn.classList.add('success');
    status.className = 'rfid-status active'; status.textContent = 'Card recognised — swipe to confirm';
    rfidDone = true;
    const wrap = document.getElementById('swipeWrap');
    wrap.style.opacity = '1'; wrap.style.pointerEvents = 'auto';
    if (!swipeInited) { swipeInited = true; initSwipe(); }
  }, 1800);
}

function initSwipe() {
  const track = document.getElementById('swipeTrack'), thumb = document.getElementById('swipeThumb'), fill = document.getElementById('swipeFill');
  const THUMB_W = 44; let dragging = false, startX = 0, startLeft = 4;
  function maxLeft() { return track.offsetWidth - THUMB_W - 4; }
  function onStart(e) { if (swipeDone) return; dragging = true; startX = e.touches ? e.touches[0].clientX : e.clientX; startLeft = parseInt(thumb.style.left || '4', 10); thumb.style.transition = 'none'; fill.style.transition = 'none'; e.preventDefault(); }
  function onMove(e) { if (!dragging || swipeDone) return; const cx = e.touches ? e.touches[0].clientX : e.clientX; let nl = Math.min(Math.max(startLeft + cx - startX, 4), maxLeft()); thumb.style.left = nl + 'px'; fill.style.width = ((nl - 4) / (maxLeft() - 4) * 100) + '%'; e.preventDefault(); }
  async function onEnd() {
    if (!dragging) return; dragging = false;
    const cur = parseInt(thumb.style.left || '4', 10), pct = (cur - 4) / (maxLeft() - 4) * 100;
    if (pct >= 88) {
      thumb.style.transition = 'left 0.22s ease'; thumb.style.left = maxLeft() + 'px';
      fill.style.transition = 'width 0.22s ease'; fill.style.width = '100%';
      track.classList.add('done'); swipeDone = true;
      document.getElementById('rfidStatus').textContent = 'Signing in…';
      const username = document.getElementById('operatorSelect').value;
      try {
        const user = await API.login(username, 'demo123');
        API.setUser(user);
        setTimeout(() => { location.href = '/operator.html'; }, 600);
      } catch (e) {
        document.getElementById('rfidStatus').className = 'rfid-status err';
        document.getElementById('rfidStatus').textContent = 'Login failed: ' + e.message;
        swipeDone = false; track.classList.remove('done');
        thumb.style.transition = 'left 0.28s ease'; thumb.style.left = '4px';
        fill.style.transition = 'width 0.28s ease'; fill.style.width = '0%';
      }
    } else {
      thumb.style.transition = 'left 0.28s ease'; thumb.style.left = '4px';
      fill.style.transition = 'width 0.28s ease'; fill.style.width = '0%';
    }
  }
  thumb.addEventListener('mousedown', onStart, { passive: false });
  thumb.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('mousemove', onMove, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}
