// pre-login.js — particles animation
(() => {
  const canvas = document.getElementById('particles-canvas'), ctx = canvas.getContext('2d');
  const N = 70, COLOR = '122,181,48'; let W, H, P = [];
  function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
  function rnd(a, b) { return Math.random() * (b - a) + a; }
  function mk() {
    const a = rnd(0, Math.PI * 2), s = rnd(0.08, 0.28);
    return { x: rnd(0,W), y: rnd(0,H), r: rnd(0.6,2), vx: Math.cos(a)*s, vy: Math.sin(a)*s, o: rnd(0.15,0.45), p: rnd(0,Math.PI*2), ps: rnd(0.004,0.015) };
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.p += p.ps;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${COLOR},${p.o * (0.6 + 0.4 * Math.sin(p.p))})`; ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < -p.r) p.x = W + p.r; if (p.x > W + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = H + p.r; if (p.y > H + p.r) p.y = -p.r;
    }
    requestAnimationFrame(draw);
  }
  resize(); P = Array.from({ length: N }, mk); draw();
  window.addEventListener('resize', resize);
})();
