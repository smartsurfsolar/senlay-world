// ─── Tab switching ──────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  const track = document.getElementById('tickerTrack');
  const meta = document.getElementById('tickerMeta');
  if (!track) return;
  try {
    const res = await fetch('/api/conditions');
    const conditions = await res.json();

    const items = conditions.map(c => {
      const wind = c.wind_speed != null ? `${c.wind_speed}km/h` : '--';
      const wave = c.wave_height != null ? ` ${c.wave_height}m waves` : '';
      const warn = (c.wave_height && c.wave_height > 3) ? ' high waves' : '';
      return `<span><span class="spot-name">${escapeHtml(c.name)}</span> ${escapeHtml(wind)}${escapeHtml(wave)}${warn}</span>`;
    }).join('');

    track.innerHTML = items + items;
    if (meta) meta.textContent =
      `Monitoring ${conditions.length} sensor locations globally. Aggregating data from weather models, ocean buoys, METAR aviation stations, tide gauges, and air quality sensors.`;
  } catch (e) {
    track.innerHTML = 'Sensor network active - <a href="demo" style="color:var(--primary,#10B981);text-decoration:underline">view live data in Demo</a>';
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
  // Run if any stat element exists on page (counter container OR stat-strip)
  const hasStatStrip = document.getElementById('statSenses') || document.getElementById('statAgents');
  const container = document.getElementById('liveCounter');
  if (!container && !hasStatStrip) return;
  try {
    const res = await fetch('/api/v1/stats');
    const data = await res.json();
    const agents = Number(data.agents_connected) || 0;
    const senses = Number(data.total_senses)     || 0;
    const keys   = Number(data.active_keys)      || 0;
    const sources = Number(data.sensor_networks) || 21;
    // Sensor networks always animate (real count)
    animateNumber(document.getElementById('statSources'), sources);
    // Only animate the rest if we have real positive numbers —
    // otherwise leave the em-dash placeholder so the hero doesn't read as "dead".
    if (agents > 0) animateNumber(document.getElementById('statAgents'), agents);
    if (senses > 0) animateNumber(document.getElementById('statSenses'), senses);
    if (keys > 0)   animateNumber(document.getElementById('statKeys'),   keys);
  } catch (e) {
    // Silent fail — em-dash placeholders stay visible. Sensor networks still show 21.
  }
}

async function loadHomepageLiveCards() {
  const grid = document.getElementById('homeLiveGrid');
  if (!grid) return;

  const desired = [
    {
      name: 'Hoi An',
      aliases: ['Hoi An'],
      domain: 'Kitesurfing proof ground',
      question: 'Can a rider safely go out now?',
      anchor: 'nearest valid hardware first, model as comparison',
      checks: 'gust factor, wind angle, waves, terrain, rescue margin',
      uncertainty: 'gust structure and source/model divergence can matter more than mean wind'
    },
    {
      name: 'Tarifa',
      aliases: ['Tarifa'],
      domain: 'Drone / coastal ops',
      question: 'Can a drone launch near the Strait?',
      anchor: 'live wind plus model disagreement check',
      checks: 'gust spread, terrain channeling, visibility, precipitation',
      uncertainty: 'Levante/Poniente shifts can invalidate generic forecast advice'
    },
    {
      name: 'Nazaré',
      aliases: ['Nazaré', 'Nazare'],
      domain: 'Marine / swell context',
      question: 'Is wave energy operationally relevant?',
      anchor: 'marine model background with source limits exposed',
      checks: 'wave height, period, swell direction, local exposure',
      uncertainty: 'canyon and break amplification can differ from offshore grid values'
    },
    {
      name: 'Cape Town',
      aliases: ['Cape Town'],
      domain: 'Field + coastal risk',
      question: 'Should outdoor work continue near the coast?',
      anchor: 'available live/model sources, freshness, confidence',
      checks: 'wind, gusts, waves, temperature, stale-source risk',
      uncertainty: 'terrain and sea-breeze effects can change local exposure'
    }
  ];

  function signalFrom(item) {
    if (!item) return { main: 'Data gap', detail: 'Open demo to check source availability and gaps.' };
    const wind = item.wind_speed != null ? `${Math.round(item.wind_speed)} km/h wind` : null;
    const gust = item.wind_gusts != null ? `${Math.round(item.wind_gusts)} km/h gusts` : null;
    const wave = item.wave_height != null ? `${item.wave_height} m waves` : null;
    const temp = item.temperature != null ? `${Math.round(item.temperature)} C` : null;
    const main = wind || wave || temp || 'Context available';
    const detail = [gust, wave, temp].filter(Boolean).join(' | ') || 'Source availability varies by location.';
    return { main, detail };
  }

  function decisionFrom(item, config) {
    if (!item) return { label: 'Context incomplete', tone: 'unknown' };
    const wind = Number(item.wind_speed);
    const gust = Number(item.wind_gusts);
    const wave = Number(item.wave_height);
    const gustSpread = Number.isFinite(gust) && Number.isFinite(wind) ? gust - wind : 0;

    if (config.name === 'Cape Town' && Number.isFinite(wave) && wave >= 3) {
      return { label: 'Context: high wave exposure', tone: 'alert' };
    }
    if (config.name === 'Nazaré' && Number.isFinite(wave) && wave >= 2.5) {
      return { label: 'Context: high swell energy', tone: 'alert' };
    }
    if (gustSpread >= 18 || gust >= 45 || wind >= 30) {
      return { label: 'Context: gust / exposure caution', tone: 'caution' };
    }
    if (wind < 8 && gustSpread >= 12) {
      return { label: 'Context: light mean, gusty structure', tone: 'caution' };
    }
    return { label: 'Context: verify locally before advice', tone: 'ok' };
  }

  try {
    const res = await fetch('/api/conditions', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const conditions = await res.json();
    const cards = desired.map(config => {
      const item = conditions.find(c => config.aliases.some(n => String(c.name || '').toLowerCase().includes(n.toLowerCase())));
      const signal = signalFrom(item);
      const decision = decisionFrom(item, config);
      if (!item) {
        return `<article class="live-location-card context-card context-card-missing">
          <div class="context-card-top"><strong>${escapeHtml(config.name)}</strong><span>${escapeHtml(config.domain)}</span></div>
          <p class="context-question">Agent question: ${escapeHtml(config.question)}</p>
          <div class="context-signal"><span class="metric-main">${signal.main}</span><span>${signal.detail}</span></div>
          <div class="context-evidence"><span>Evidence anchor</span><strong>${escapeHtml(config.anchor)}</strong></div>
          <div class="context-evidence"><span>Uncertainty</span><strong>${escapeHtml(config.uncertainty)}</strong></div>
          <div class="context-verdict unknown">Context: source availability needs full check</div>
          <a class="context-link" href="/demo">Open full evidence report</a>
        </article>`;
      }
      return `<article class="live-location-card context-card">
        <div class="context-card-top"><strong>${escapeHtml(item.name || config.name)}</strong><span>${escapeHtml(config.domain)}</span></div>
        <p class="context-question">Agent question: ${escapeHtml(config.question)}</p>
        <div class="context-signal"><span class="metric-main">${escapeHtml(signal.main)}</span><span>${escapeHtml(signal.detail)}</span></div>
        <div class="context-evidence"><span>Evidence anchor</span><strong>${escapeHtml(config.anchor)}</strong></div>
        <div class="context-evidence"><span>Checks</span><strong>${escapeHtml(config.checks)}</strong></div>
        <div class="context-evidence"><span>Uncertainty</span><strong>${escapeHtml(config.uncertainty)}</strong></div>
        <div class="context-verdict ${decision.tone}">${escapeHtml(decision.label)}</div>
        <a class="context-link" href="/demo">Open full evidence report</a>
      </article>`;
    }).join('');
    grid.innerHTML = cards;
  } catch (e) {
    grid.querySelectorAll('.live-location-card').forEach(card => {
      card.innerHTML += '<a href="/demo">Open live demo</a>';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadTicker();
  loadAgentCounter();
  loadHomepageLiveCards();
  // Refresh counter every 30s so visitors watching the page see it move
  setInterval(loadAgentCounter, 30 * 1000);
});
