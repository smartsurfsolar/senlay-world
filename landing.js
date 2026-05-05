// ─── Tab switching ──────────────────────────────────────────────────
function showTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
}

// ─── Copy code block ────────────────────────────────────────────────
function copyCode(btn) {
  const code = btn.closest('.code-block-wrap').querySelector('.code-block');
  navigator.clipboard.writeText(code.textContent).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
}

// ─── Live ticker ────────────────────────────────────────────────────
async function loadTicker() {
  try {
    const res = await fetch('/api/conditions');
    const conditions = await res.json();
    const track = document.getElementById('tickerTrack');

    const items = conditions.map(c => {
      const wind = c.wind_speed != null ? `${c.wind_speed}km/h` : '--';
      const wave = c.wave_height != null ? ` 🌊${c.wave_height}m` : '';
      const warn = (c.wave_height && c.wave_height > 3) ? ' ⚠️' : '';
      return `<span><span class="spot-name">${c.name}</span> ${wind}${wave}${warn}</span>`;
    }).join('');

    track.innerHTML = items + items;
    document.getElementById('tickerMeta').textContent =
      `Monitoring ${conditions.length} sensor locations globally. Aggregating data from weather models, ocean buoys, METAR aviation stations, tide gauges, and air quality sensors.`;
  } catch (e) {
    document.getElementById('tickerTrack').innerHTML = 'Sensor network active — <a href="demo" style="color:var(--primary,#10B981);text-decoration:underline">view live data in Demo &rarr;</a>';
  }
}

// ─── Live agent counter (homepage hero) ─────────────────────────────
function animateNumber(el, target, durationMs = 1200) {
  if (!el) return;
  const start = Number(el.dataset.current || 0);
  const end = Number(target) || 0;
  if (start === end) return;
  const t0 = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - t0) / durationMs);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(start + (end - start) * eased);
    el.textContent = val.toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
    else { el.textContent = end.toLocaleString(); el.dataset.current = end; }
  }
  requestAnimationFrame(tick);
}

async function loadAgentCounter() {
  const container = document.getElementById('liveCounter');
  if (!container) return;
  try {
    const res = await fetch('/api/v1/stats');
    const data = await res.json();
    const agents = Number(data.agents_connected) || 0;
    const senses = Number(data.total_senses)     || 0;
    const sources = Number(data.sensor_networks) || 21;
    // Sensor networks always animate (real count)
    animateNumber(document.getElementById('statSources'), sources);
    // Only animate agents/senses if we have a real positive number —
    // otherwise leave the em-dash placeholder so the hero doesn't read as "dead".
    const agentsEl = document.getElementById('statAgents');
    const sensesEl = document.getElementById('statSenses');
    if (agents > 0) animateNumber(agentsEl, agents);
    if (senses > 0) animateNumber(sensesEl, senses);
  } catch (e) {
    // Silent fail — em-dash placeholders stay visible. Sensor networks still show 21.
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadTicker();
  loadAgentCounter();
  // Refresh counter every 30s so visitors watching the page see it move
  setInterval(loadAgentCounter, 30 * 1000);
});
