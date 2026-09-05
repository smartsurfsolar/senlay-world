const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
if (navToggle && nav) {
  if (!nav.id) nav.id = 'site-navigation';
  navToggle.setAttribute('aria-controls', nav.id);
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

const sportData = {
  surf: {
    risk: 'Reef contact window rises when low tide, angled swell, and failed paddle-outs overlap.',
    sources: 'Validated or curated bathymetry when available, tide level, swell direction, and rescue-margin markers.',
    decision: 'Warn: move peak, wait for tide, or downgrade to monitored session.'
  },
  kite: {
    risk: 'Offshore wind drift and gust spread matter more than clean average wind speed.',
    sources: 'Nearest live wind, gust factor, launch geometry, current, downwind escape zones.',
    decision: 'Caution: launch only with buddy, avoid offshore tack, keep rescue threshold low.'
  },
  sup: {
    risk: 'Distance from shore, headwind return, chop, and current can turn a calm start into a rescue.',
    sources: 'Wind trend, current vector, tide phase, route bearing, fatigue duration.',
    decision: 'Monitor: shorten route and require check-in at the turn point.'
  },
  foil: {
    risk: 'High speed plus a charted or curated shallow hazard or crowded channel creates a small error window.',
    sources: 'Validated chart or curated spot hazard, traffic zone, wind shadow, wave period, board speed.',
    decision: 'Warn: keep foil line outside shallow contour and avoid overlap with swimmers.'
  },
  sailing: {
    risk: 'Squall lines, gust front timing, tide gate, and lee-shore geometry dominate the call.',
    sources: 'Radar nowcast, METAR, buoy trend, tide current, route exposure.',
    decision: 'Go/no-go: delay departure or reef early when front timing crosses route.'
  },
  wing: {
    risk: 'Wing drift after fall, foil impact, and offshore wind combine quickly in marginal conditions.',
    sources: 'Wind angle, board separation, current, depth, rider stop duration.',
    decision: 'Escalate: check-in after stop plus separation and offshore vector.'
  }
};

document.querySelectorAll('[data-sport]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-sport]').forEach((b) => b.classList.remove('is-active'));
    button.classList.add('is-active');
    const data = sportData[button.dataset.sport] || sportData.surf;
    document.querySelector('[data-risk]').textContent = data.risk;
    document.querySelector('[data-sources]').textContent = data.sources;
    document.querySelector('[data-decision]').textContent = data.decision;
  });
});

function addHomeLayerStackSection() {
  if (document.body?.dataset.page !== 'home') return;
  const main = document.querySelector('main');
  if (!main || document.querySelector('[data-layer-stack-home]')) return;

  const section = document.createElement('section');
  section.className = 'section';
  section.dataset.layerStackHome = 'true';
  section.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Layer stack</span>
        <h2>A physical-world layer catalog for outdoor AI.</h2>
        <p>The main Senlay app exposes a versioned layer stack for live sensors, forecast models, terrain elevation, satellite visual context, hazards, and risk operations. Datum-qualified bathymetry, land cover, obstacles, coastline/access, and telemetry remain explicit planned or customer-supplied layers. Static geodata stays precomputed and cached.</p>
      </div>
      <div class="grid-3">
        <article class="card"><span class="tag">Available now</span><h3>Sensors, models, terrain elevation, hazards, risk.</h3><p>Demo responses include the current layer context beside deterministic risk events so agents can explain what is known, what is inferred, and what remains unavailable.</p></article>
        <article class="card"><span class="tag blue">Provider catalog</span><h3>Active and planned sources stay distinct.</h3><p>NOAA, correctly licensed Open-Meteo endpoints, AviationWeather, keyed OpenAQ, NASA, USGS, and configured sensor networks are active where covered. GEBCO, WorldCover, buildings, Overture, and Natural Earth are cataloged as future static layers until actually ingested. GEBCO is coarse regional depth context, not a chart or a detector for spot-scale reefs, sandbars, or obstructions.</p></article>
        <article class="card"><span class="tag amber">Next layers</span><h3>Roughness, buildings, access, and telemetry.</h3><p>The roadmap adds cached roughness sectors, building/obstacle density, rescue/access vectors, and SmartSurf or customer device telemetry without blocking live public routes.</p></article>
      </div>
      <div class="actions">
        <a class="button blue" href="/demo">Try layer-aware demo</a>
        <a class="button soft" href="/api/layers/catalog">View layer catalog JSON</a>
        <a class="button soft" href="/docs.html">Read API docs</a>
      </div>
    </div>
  `;
  main.appendChild(section);
}

addHomeLayerStackSection();
