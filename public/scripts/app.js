// ─── State ──────────────────────────────────────────────────────────
let state = {
  provider: 'demo',
  apiKey: '',
  lat: null,
  lng: null,
  locationName: '',
  connected: false,
  messages: [],
  sensors: null,
  satellite: null,
  extended: null,
  activeSources: 5,
  spots: [],
  units: 'metric',
  field: 'drone',
  pwmFetchedAt: null  // timestamp of last sensor data fetch
};

const MAX_MESSAGES = 20; // trim conversation history to last N messages
const API_KEY_STORAGE_KEY = 'senlay_apikey';
const LOCATION_STORAGE_KEY = 'senlay_location';
const API_KEY_REMEMBER_KEY = 'senlay_apikey_remember';
const DEMO_PRESETS = {
  tarifa: { lat: 36.0143, lng: -5.6044, name: 'Tarifa, Spain' },
  nazare: { lat: 39.6019, lng: -9.0707, name: 'Nazaré, Portugal' },
  lisbon: { lat: 38.7223, lng: -9.1393, name: 'Lisbon, Portugal' },
  san_francisco: { lat: 37.7749, lng: -122.4194, name: 'San Francisco, USA' },
  berlin: { lat: 52.52, lng: 13.405, name: 'Berlin, Germany' },
  reykjavik: { lat: 64.1466, lng: -21.9426, name: 'Reykjavik, Iceland' },
  cape_town: { lat: -33.9249, lng: 18.4241, name: 'Cape Town, South Africa' },
  tokyo: { lat: 35.6762, lng: 139.6503, name: 'Tokyo, Japan' },
  hossegor: { lat: 43.6651, lng: -1.4442, name: 'Hossegor, France' },
  maui: { lat: 20.7984, lng: -156.3319, name: 'Maui, Hawaii' },
  hoi_an: { lat: 15.8801, lng: 108.3380, name: 'Hoi An, Vietnam' },
  rio: { lat: -22.9068, lng: -43.1729, name: 'Rio de Janeiro, Brazil' }
};

const DEMO_SCENARIOS = {
  drone: {
    field: 'drone',
    preset: 'san_francisco',
    prompt: 'Can a drone safely fly here now? Give a go/no-go answer and explain the physical evidence.'
  },
  watersports: {
    field: 'kitesurfing',
    preset: 'tarifa',
    prompt: 'Is this beach safe for kitesurfing right now? Explain wind, gusts, waves, and uncertainty.'
  },
  fieldwork: {
    field: 'construction',
    preset: 'berlin',
    prompt: 'Are conditions safe for outdoor work here now? Consider wind, weather, air quality, temperature, and practical restrictions.'
  }
};

// Unit conversion helpers
const UNIT_LABELS = {
  metric:   { wind: 'km/h', temp: '°C',  elev: 'm',  wave: 'm',  press: 'hPa' },
  imperial: { wind: 'mph',  temp: '°F',  elev: 'ft', wave: 'ft', press: 'inHg' },
  knots:    { wind: 'kts',  temp: '°C',  elev: 'm',  wave: 'm',  press: 'hPa' },
  ms:       { wind: 'm/s',  temp: '°C',  elev: 'm',  wave: 'm',  press: 'hPa' }
};
function cWind(kmh) {
  if (kmh == null) return '--';
  const u = state.units;
  const v = u === 'imperial' ? kmh * 0.6214 : u === 'knots' ? kmh * 0.54 : u === 'ms' ? kmh / 3.6 : kmh;
  return Math.round(v * 10) / 10;
}
function cTemp(c) {
  if (c == null) return '--';
  return state.units === 'imperial' ? Math.round((c * 9/5 + 32) * 10) / 10 : c;
}
function cElev(m) {
  if (m == null) return '--';
  return state.units === 'imperial' ? Math.round(m * 3.2808 * 10) / 10 : m;
}
function cWave(m) {
  if (m == null) return '--';
  return state.units === 'imperial' ? Math.round(m * 3.2808 * 10) / 10 : m;
}
function cPress(hpa) {
  if (hpa == null) return '--';
  return state.units === 'imperial' ? Math.round(hpa * 0.02953 * 100) / 100 : hpa;
}
function uL(type) { return (UNIT_LABELS[state.units] || UNIT_LABELS.metric)[type]; }

const SOURCE_FIELD_LABELS = {
  wind_speed_10m: 'wind speed',
  wind_direction_10m: 'wind direction',
  wind_gusts_10m: 'gusts',
  temperature_2m: 'temperature',
  apparent_temperature: 'feels like',
  relative_humidity_2m: 'humidity',
  pressure_msl: 'pressure',
  wave_height: 'wave height',
  wave_period: 'wave period',
  swell_wave_height: 'swell height',
  water_temperature_c: 'water temperature',
  pm2_5: 'PM2.5',
  pm10: 'PM10'
};

// ─── HTML escaping (prevents XSS when setting innerHTML) ────────────
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sourceBadge(sourceInfo, modelLabel = 'MODEL') {
  const mode = sourceInfo?.mode;
  if (mode === 'hardware_with_model_fallback') return '<span class="badge-hw">HARDWARE-FIRST</span>';
  return `<span class="badge-model">${modelLabel}</span>`;
}

function humanizeSourceField(field) {
  return SOURCE_FIELD_LABELS[field] || field.replace(/_/g, ' ');
}

function sourceSummary(sourceInfo) {
  if (!sourceInfo || sourceInfo.mode === 'model_only') {
    return 'Model-derived current conditions';
  }
  const fields = (sourceInfo.overridden_fields || []).map(humanizeSourceField);
  const firstKey = Object.keys(sourceInfo.field_sources || {})[0];
  const firstSource = firstKey ? sourceInfo.field_sources[firstKey] : null;
  const sourceName = firstSource?.name || firstSource?.source || 'nearby hardware sensor';
  const distance = firstSource?.distance_km != null ? ` ${firstSource.distance_km}km away` : '';
  const fieldText = fields.length ? ` for ${fields.join(', ')}` : '';
  return `Hardware-first${fieldText} via ${sourceName}${distance}`;
}

function syncApiKeyStorage() {
  try {
    const remember = !!document.getElementById('rememberApiKey')?.checked;
    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    localStorage.removeItem(API_KEY_REMEMBER_KEY);
    if (!state.apiKey) return;
    if (remember) {
      localStorage.setItem(API_KEY_STORAGE_KEY, state.apiKey);
      localStorage.setItem(API_KEY_REMEMBER_KEY, '1');
      return;
    }
    sessionStorage.setItem(API_KEY_STORAGE_KEY, state.apiKey);
  } catch (_) {}
}

function applyLocation(lat, lng, name) {
  const hadConnection = state.connected;
  state.lat = lat;
  state.lng = lng;
  state.locationName = name;
  if (hadConnection) {
    state.connected = false;
    state.sensors = null;
    state.satellite = null;
    state.extended = null;
    state.pwmFetchedAt = null;
    document.getElementById('mainArea')?.classList.add('hidden');
    document.getElementById('statusBar')?.classList.add('hidden');
    document.getElementById('setupPanel')?.classList.remove('collapsed');
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
      statusEl.className = 'conn-status disconnected';
      statusEl.innerHTML = '<span class="conn-dot"></span> Location changed. Connect again for fresh data.';
    }
    document.getElementById('connDetails')?.classList.add('hidden');
  }
  const display = document.getElementById('locationDisplay');
  if (display) {
    display.textContent = `${name} (${lat}, ${lng})`;
  }
  const spotSelect = document.getElementById('spotSelect');
  if (spotSelect) spotSelect.value = '';
  savePrefs();
  updateDemoGuide();
}

// ─── Browser persistence ─────────────────────────────────────────────
function savePrefs() {
  try {
    localStorage.setItem('senlay_provider', state.provider);
    localStorage.setItem('senlay_units', state.units);
    localStorage.setItem('senlay_field', state.field);
    if (state.lat != null) {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
        lat: state.lat, lng: state.lng, name: state.locationName
      }));
    }
    syncApiKeyStorage();
  } catch (_) {}
}

function loadPrefs() {
  try {
    const provider = localStorage.getItem('senlay_provider');
    const units = localStorage.getItem('senlay_units');
    const field = localStorage.getItem('senlay_field');
    const apiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY) || localStorage.getItem(API_KEY_STORAGE_KEY);
    const rememberApiKey = localStorage.getItem(API_KEY_REMEMBER_KEY) === '1';
    const locRaw = localStorage.getItem(LOCATION_STORAGE_KEY);

    if (provider) {
      state.provider = provider;
      const sel = document.getElementById('providerSelect');
      if (sel) sel.value = provider;
      const row = document.getElementById('apiKeyRow');
      if (provider !== 'demo' && row) row.classList.remove('hidden');
    }
    if (units) {
      state.units = units;
      const sel = document.getElementById('unitSelect');
      if (sel) sel.value = units;
    }
    if (field) {
      state.field = field;
      const sel = document.getElementById('fieldSelect');
      if (sel) {
        sel.value = field;
        if (sel.value !== field) {
          state.field = 'general';
          sel.value = 'general';
        }
      }
    }
    if (apiKey) {
      state.apiKey = apiKey;
      const input = document.getElementById('userApiKey');
      if (input) input.value = apiKey;
    }
    const rememberToggle = document.getElementById('rememberApiKey');
    if (rememberToggle) rememberToggle.checked = rememberApiKey;
    if (locRaw) {
      const loc = JSON.parse(locRaw);
      applyLocation(loc.lat, loc.lng, loc.name);
    }
  } catch (_) {}
}

function currentGuideStep() {
  const hasProvider = state.provider === 'demo' || !!state.apiKey;
  const hasLocation = state.lat !== null && state.lng !== null;
  const hasQuestion = state.messages.some(m => m.role === 'user');
  if (!hasProvider) return 1;
  if (!hasLocation) return 2;
  if (!state.connected) return 3;
  if (!hasQuestion) return 4;
  return 5;
}

function updateDemoGuide() {
  const steps = document.querySelectorAll('.guide-step');
  if (!steps.length) return;
  const current = currentGuideStep();
  steps.forEach(step => {
    const n = Number(step.dataset.guideStep);
    step.classList.toggle('complete', n < current);
    step.classList.toggle('active', n === current || (current > 4 && n === 4));
  });
  const status = document.getElementById('guideStatus');
  if (!status) return;
  const messages = {
    1: 'Start with Demo Mode, or choose a provider and paste your key.',
    2: 'Choose a place and use case. Presets are the fastest path.',
    3: 'Connect to load the live data behind the answer.',
    4: 'Ask a question or use a prompt chip below the chat.',
    5: 'Demo complete. Change the place, use case, or units to compare another scenario.'
  };
  status.textContent = messages[current] || messages[5];
  const action = document.getElementById('guideAction');
  if (action) {
    const actions = {
      1: 'Use Demo Mode',
      2: 'Choose Place',
      3: 'Connect Now',
      4: 'Try a Question',
      5: 'Run Another Place'
    };
    action.textContent = actions[current] || actions[5];
  }
}

function setDemoMode() {
  const select = document.getElementById('providerSelect');
  if (select) {
    select.value = 'demo';
    onProviderChange();
  }
  focusDemoStep('location');
}

function advanceDemoGuide() {
  const current = currentGuideStep();
  if (current === 1) {
    setDemoMode();
    return;
  }
  if (current === 2) {
    focusDemoStep('location');
    return;
  }
  if (current === 3) {
    connectToPWM();
    return;
  }
  if (current === 4) {
    usePrompt('Is it safe for this activity right now?');
    return;
  }
  focusDemoStep('location');
}

function loadDemoScenario(key) {
  const scenario = DEMO_SCENARIOS[key];
  if (!scenario) return;
  const providerSelect = document.getElementById('providerSelect');
  if (providerSelect) {
    providerSelect.value = 'demo';
    onProviderChange();
  }
  const fieldSelect = document.getElementById('fieldSelect');
  if (fieldSelect) {
    fieldSelect.value = scenario.field;
    onFieldChange();
  } else {
    state.field = scenario.field;
  }
  usePresetLocation(scenario.preset);
  const chatInput = document.getElementById('chatInput');
  if (chatInput) chatInput.value = scenario.prompt;
  const status = document.getElementById('guideStatus');
  if (status) status.textContent = 'Scenario loaded. Connect to fetch live physical data, then send the prepared question.';
  focusDemoStep('connect');
}

function focusDemoStep(step) {
  const map = {
    mode: 'providerCard',
    location: 'locationCard',
    connect: 'connectCard',
    ask: 'chatInput'
  };
  if (step === 'connect' && state.lat === null) {
    step = 'location';
  }
  if (step === 'ask' && !state.connected) {
    step = state.lat === null ? 'location' : 'connect';
  }
  if (['mode', 'location', 'connect'].includes(step)) {
    document.getElementById('setupPanel')?.classList.remove('collapsed');
  }
  const target = document.getElementById(map[step]);
  if (!target) return;
  document.querySelectorAll('.setup-card.guide-focus').forEach(el => el.classList.remove('guide-focus'));
  if (target.classList.contains('setup-card')) {
    target.classList.add('guide-focus');
    setTimeout(() => target.classList.remove('guide-focus'), 1800);
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (target.matches('input, select, button')) target.focus();
}

// ─── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPrefs();
  loadSpots();
  loadTicker();
  updateDemoGuide();
  // Auto-detect location if user hasn't set one yet
  if (state.lat === null && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (state.lat !== null) return; // user picked manually while waiting
        state.lat = +pos.coords.latitude.toFixed(4);
        state.lng = +pos.coords.longitude.toFixed(4);
        state.locationName = `My Location`;
        document.getElementById('locationDisplay').textContent = `My Location (${state.lat}, ${state.lng})`;
        // Reverse geocode for nicer name
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${state.lat}&lon=${state.lng}&format=json&zoom=10`, { headers: { 'User-Agent': 'senlay.world' } })
          .then(r => r.json())
          .then(data => {
            if (data.address) {
              const parts = [data.address.city || data.address.town || data.address.village, data.address.country].filter(Boolean);
              if (parts.length) {
                state.locationName = parts.join(', ');
                document.getElementById('locationDisplay').textContent = `${state.locationName} (${state.lat}, ${state.lng})`;
              }
            }
          })
          .catch(() => {});
        savePrefs();
        updateDemoGuide();
      },
      () => {} // silently fail — user can pick manually
    );
  }
});

// ─── Spots ──────────────────────────────────────────────────────────
async function loadSpots() {
  try {
    const res = await fetch('/api/spots');
    state.spots = await res.json();
    refreshSpotDropdown();
  } catch (e) {
    console.error('Failed to load spots:', e);
  }
}

// ─── Setup: Provider ────────────────────────────────────────────────
function onProviderChange() {
  const val = document.getElementById('providerSelect').value;
  state.provider = val;
  const row = document.getElementById('apiKeyRow');
  if (val === 'demo') {
    row.classList.add('hidden');
  } else {
    row.classList.remove('hidden');
    const input = document.getElementById('userApiKey');
    if (input && state.apiKey) input.value = state.apiKey;
  }
  savePrefs();
  updateDemoGuide();
}

function onRememberApiKeyChange() {
  const input = document.getElementById('userApiKey');
  state.apiKey = input ? input.value.trim() : state.apiKey;
  syncApiKeyStorage();
  updateDemoGuide();
}

function onApiKeyInput() {
  const input = document.getElementById('userApiKey');
  state.apiKey = input ? input.value.trim() : '';
  syncApiKeyStorage();
  updateDemoGuide();
}

function onUnitChange() {
  state.units = document.getElementById('unitSelect').value;
  savePrefs();
  if (state.sensors) renderSensorFeed();
}

// Map field selections to spot types they should prioritize
const FIELD_SPOT_TYPES = {
  kitesurfing: ['kite', 'surf', 'sailing'],
  sailing: ['sailing', 'kite', 'surf'],
  drone: ['drone', 'city', 'general'],
  agriculture: ['agriculture'],
  construction: ['construction', 'city'],
  hiking: ['hiking', 'general'],
  paragliding: ['paragliding', 'hiking'],
  fishing: ['sailing', 'surf', 'kite'],
  events: ['city', 'general'],
  general: null // show all
};

const FIELD_LABELS = {
  kitesurfing: 'Kitesurfing / Watersports',
  sailing: 'Sailing / Marine',
  drone: 'Drone / UAV Operations',
  agriculture: 'Agriculture / Farming',
  construction: 'Construction / Outdoor Work',
  hiking: 'Hiking / Trekking',
  paragliding: 'Paragliding / Aviation Weather',
  fishing: 'Fishing / Coastal Conditions',
  events: 'Outdoor Events',
  general: 'General Physical-World Query'
};

function onFieldChange() {
  const sel = document.getElementById('fieldSelect');
  if (!sel) return;
  state.field = sel.value;
  savePrefs();
  refreshSpotDropdown();
  // Reset conversation when field changes — new persona, fresh context
  if (state.connected) {
    document.getElementById('chatMessages').innerHTML = '';
    state.messages = [];
    addSystemMessage(`Field changed to ${FIELD_LABELS[state.field] || state.field}. Ask me anything — I'm now tuned to this use case.`);
  }
  updateDemoGuide();
}

function refreshSpotDropdown() {
  const sel = document.getElementById('spotSelect');
  if (!sel || !state.spots.length) return;
  // Clear all optgroups but keep placeholder
  while (sel.options.length > 1) sel.remove(1);
  while (sel.querySelector('optgroup')) sel.querySelector('optgroup').remove();

  const allowedTypes = FIELD_SPOT_TYPES[state.field];
  const TYPE_LABELS = {
    kite: 'Kitesurfing', surf: 'Surfing', sailing: 'Sailing',
    paragliding: 'Paragliding', hiking: 'Hiking', drone: 'Drone',
    agriculture: 'Agriculture', construction: 'Construction',
    running: 'Running', city: 'Cities', general: 'Notable Locations'
  };
  const groups = {};
  state.spots.forEach((s, i) => {
    const t = s.type || 'general';
    if (allowedTypes && !allowedTypes.includes(t)) return; // filter by field
    if (!groups[t]) groups[t] = [];
    groups[t].push({ ...s, _idx: i });
  });
  for (const [type, spots] of Object.entries(groups)) {
    const grp = document.createElement('optgroup');
    grp.label = TYPE_LABELS[type] || type;
    spots.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s._idx;
      opt.textContent = `${s.name}, ${s.country}`;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  }
}

// ─── Setup: Location ────────────────────────────────────────────────
function onSpotSelect() {
  const idx = document.getElementById('spotSelect').value;
  if (idx === '') return;
  const spot = state.spots[parseInt(idx)];
  applyLocation(spot.lat, spot.lng, `${spot.name}, ${spot.country}`);
}

function useGeolocation() {
  if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      applyLocation(+pos.coords.latitude.toFixed(4), +pos.coords.longitude.toFixed(4), 'My Location');
    },
    err => alert('Location error: ' + err.message)
  );
}

function useManualCoords() {
  const lat = parseFloat(document.getElementById('manualLat').value);
  const lng = parseFloat(document.getElementById('manualLng').value);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    alert('Enter valid coordinates (lat -90..90, lng -180..180)');
    return;
  }
  applyLocation(lat, lng, `${lat}, ${lng}`);
}

function usePresetLocation(key) {
  const preset = DEMO_PRESETS[key];
  if (!preset) return;
  applyLocation(preset.lat, preset.lng, preset.name);
  focusDemoStep('connect');
}

async function searchCity() {
  const input = document.getElementById('citySearch');
  const query = input.value.trim();
  if (!query) return;
  input.disabled = true;
  document.getElementById('locationDisplay').textContent = 'Searching...';
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'senlay.world' }
    });
    const data = await res.json();
    if (!data || data.length === 0) {
      document.getElementById('locationDisplay').textContent = 'Place not found. Try another name.';
      input.disabled = false;
      return;
    }
    const place = data[0];
    applyLocation(parseFloat(place.lat), parseFloat(place.lon), place.display_name.split(',').slice(0, 2).join(',').trim());
  } catch (e) {
    document.getElementById('locationDisplay').textContent = 'Search failed: ' + escHtml(e.message);
  }
  input.disabled = false;
}

// ─── Connect ────────────────────────────────────────────────────────
async function connectToPWM() {
  if (state.lat === null || state.lng === null) { alert('Select a location first'); return; }

  if (state.provider !== 'demo') {
    state.apiKey = document.getElementById('userApiKey').value.trim();
    if (!state.apiKey) { alert('Enter your API key'); return; }
  }
  savePrefs();

  const statusEl = document.getElementById('connectionStatus');
  const btn = document.getElementById('connectBtn');
  const providerName = state.provider === 'openai' ? 'GPT-4o' : 'Claude';

  statusEl.className = 'conn-status connecting';
  statusEl.innerHTML = '<span class="conn-dot"></span> Connecting ' + providerName + ' to Physical World Model...';
  btn.disabled = true;
  btn.textContent = 'Connecting...';

  try {
    const res = await fetch(`/api/pwm?lat=${state.lat}&lng=${state.lng}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    state.sensors = data.sensors;
    state.satellite = data.satellite;
    state.extended = data.extended || null;
    state.activeSources = data.active_sources || 5;
    state.health = data.health || [];
    state.connected = true;
    state.pwmFetchedAt = Date.now();

    statusEl.className = 'conn-status connected';
    statusEl.innerHTML = '<span class="conn-dot"></span> ' + providerName + ' is connected to physical context';

    const details = document.getElementById('connDetails');
    details.classList.remove('hidden');
    details.innerHTML = `Provider: ${providerName} | Location: ${escHtml(state.locationName)} | ${state.activeSources} sensor sources active`;

    document.getElementById('mainArea').classList.remove('hidden');
    document.getElementById('setupPanel').classList.add('collapsed');
    document.getElementById('statusBar').classList.remove('hidden');
    document.getElementById('statusBarText').textContent =
      `${providerName} connected — ${state.locationName} — ${state.activeSources} sensor sources active`;

    document.getElementById('chatProviderLabel').textContent = providerName + ' + Physical World Model';

    renderSensorFeed();

    document.getElementById('chatMessages').innerHTML = '';
    state.messages = [];
    const fieldLabel = FIELD_LABELS[state.field] || state.field;
    addSystemMessage(`Senlay connected at ${state.locationName}. ${state.activeSources} sensor sources active. Mode: ${fieldLabel}. What would you like to know?`);
    updateDemoGuide();

  } catch (e) {
    statusEl.className = 'conn-status disconnected';
    statusEl.textContent = 'Connection failed: ' + e.message;
    updateDemoGuide();
  }

  btn.disabled = false;
  btn.textContent = 'Connect to Physical World';
}

function toggleSetup() {
  document.getElementById('setupPanel').classList.toggle('collapsed');
}

// ─── Staleness helper ────────────────────────────────────────────────
function stalenessLabel() {
  if (!state.pwmFetchedAt) return '';
  const mins = Math.round((Date.now() - state.pwmFetchedAt) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

// ─── Sensor Feed ────────────────────────────────────────────────────
function renderSensorFeed() {
  const feed = document.getElementById('sensorFeed');
  if (!state.sensors) { feed.innerHTML = '<p class="sensor-placeholder">No data</p>'; return; }

  const { layers } = state.sensors;
  let html = '';

  // Atmosphere
  const atm = layers.atmosphere?.current;
  const atmSource = layers.atmosphere?.current_source;
  if (atm) {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">ATMOSPHERE ${sourceBadge(atmSource)}</div>
      <div class="sensor-row"><span class="sense-verb">Wind:</span> <span class="sense-value">${cWind(atm.wind_speed_10m)} ${uL('wind')} from ${atm.wind_direction_10m}° (gusts ${cWind(atm.wind_gusts_10m)})</span></div>
      <div class="sensor-row"><span class="sense-verb">Temperature:</span> <span class="sense-value">${cTemp(atm.temperature_2m)}${uL('temp')} (feels ${cTemp(atm.apparent_temperature)}${uL('temp')})</span></div>
      <div class="sensor-row"><span class="sense-verb">Reading:</span> <span class="sense-value">Pressure ${cPress(atm.pressure_msl)} ${uL('press')}</span></div>
      <div class="sensor-row"><span class="sense-verb">Detecting:</span> <span class="sense-value">Humidity ${atm.relative_humidity_2m}% | Clouds ${atm.cloud_cover}%</span></div>
      <div class="sensor-row"><span class="sense-verb">Source:</span> <span class="sense-value">${escHtml(sourceSummary(atmSource))}</span></div>
    </div>`;
  }

  // Hydrosphere
  const hyd = layers.hydrosphere?.current;
  const hydSource = layers.hydrosphere?.current_source;
  if (hyd && hyd.wave_height != null) {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">HYDROSPHERE ${sourceBadge(hydSource)}</div>
      <div class="sensor-row"><span class="sense-verb">Waves:</span> <span class="sense-value">${cWave(hyd.wave_height)} ${uL('wave')} (${hyd.wave_period}s period)</span></div>`;
    if (hyd.swell_wave_height != null) {
      html += `<div class="sensor-row"><span class="sense-verb">Swell:</span> <span class="sense-value">${cWave(hyd.swell_wave_height)} ${uL('wave')} from ${hyd.swell_wave_direction}°</span></div>`;
    }
    if (hyd.water_temperature_c != null) {
      html += `<div class="sensor-row"><span class="sense-verb">Water:</span> <span class="sense-value">${cTemp(hyd.water_temperature_c)}${uL('temp')}</span></div>`;
    }
    html += `<div class="sensor-row"><span class="sense-verb">Source:</span> <span class="sense-value">${escHtml(sourceSummary(hydSource))}</span></div>`;
    html += `</div>`;
  }

  // Terrain
  const ter = layers.terrain;
  if (ter && !ter.error) {
    const label = ter.is_ocean
      ? `Depth ${cElev(Math.abs(ter.elevation_at_point))} ${uL('elev')} (ocean)`
      : `Elevation ${cElev(ter.elevation_at_point)} ${uL('elev')}`;
    html += `<div class="sensor-section">
      <div class="sensor-section-title">TERRAIN <span class="badge-model">MODEL</span></div>
      <div class="sensor-row"><span class="sense-verb">Terrain:</span> <span class="sense-value">${label}</span></div>
      <div class="sensor-row"><span class="sense-verb">Profile:</span> <span class="sense-value">${ter.depth_profile.map(d => cElev(d) + uL('elev')).join(', ')}</span></div>
    </div>`;
  }

  // Satellite
  html += `<div class="sensor-section">
    <div class="sensor-section-title">SATELLITE</div>`;
  if (state.satellite?.google_satellite_url) {
    html += `<img src="${escHtml(state.satellite.google_satellite_url)}" style="width:100%;border-radius:6px;margin:6px 0" alt="Satellite view">`;
  } else if (state.lat && state.lng) {
    const z = 13;
    const tileX = Math.floor((state.lng + 180) / 360 * Math.pow(2, z));
    const tileY = Math.floor((1 - Math.log(Math.tan(state.lat * Math.PI / 180) + 1 / Math.cos(state.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
    html += `<img src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${tileY}/${tileX}" style="width:100%;border-radius:6px;margin:6px 0" alt="Satellite view" onerror="this.style.display='none'">`;
  }
  if (state.satellite?.sentinel2?.available) {
    const s = state.satellite.sentinel2;
    html += `<div class="sensor-row"><span class="sense-verb">Sentinel-2:</span> <span class="sense-value">${escHtml(new Date(s.date).toLocaleDateString())} (${s.cloud_cover}% cloud)</span></div>`;
  } else {
    html += `<div class="sensor-row"><span class="sense-value">Sentinel-2: ${escHtml(state.satellite?.sentinel2?.reason || 'Checking...')}</span></div>`;
  }
  html += `</div>`;

  // Air Quality
  const aq = layers.air_quality?.current;
  const aqSource = layers.air_quality?.current_source;
  if (aq) {
    const uvWarn = aq.uv_index >= 8 ? ' Very High' : aq.uv_index >= 6 ? ' High' : '';
    html += `<div class="sensor-section">
      <div class="sensor-section-title">AIR QUALITY ${sourceBadge(aqSource, 'FUSED')}</div>
      <div class="sensor-row"><span class="sense-verb">AQI:</span> <span class="sense-value">${aq.european_aqi} | PM2.5: ${aq.pm2_5} µg/m³</span></div>
      <div class="sensor-row"><span class="sense-verb">UV Index:</span> <span class="sense-value">${aq.uv_index}${escHtml(uvWarn)}</span></div>
      <div class="sensor-row"><span class="sense-verb">Source:</span> <span class="sense-value">${escHtml(sourceSummary(aqSource))}</span></div>
    </div>`;
  }

  // ── EXTENDED: Weather Alerts ──
  const ext = state.extended || {};
  const alerts = ext.weather_alerts || [];
  if (alerts.length > 0) {
    html += `<div class="sensor-section" style="border-left:3px solid var(--red)">
      <div class="sensor-section-title">WEATHER ALERTS <span class="badge-hw">LIVE</span></div>`;
    for (const a of alerts.slice(0, 3)) {
      html += `<div class="sensor-row"><span class="sense-value" style="color:var(--red)">${escHtml(a.event || a.headline || 'Alert')}</span></div>`;
      if (a.area) html += `<div class="sensor-row" style="padding-left:20px"><span class="sense-value" style="font-size:11px">${escHtml(a.area)}</span></div>`;
    }
    html += `</div>`;
  }

  // ── EXTENDED: Live Wind Sensors ──
  const windSensors = ext.wind_sensors || [];
  if (windSensors.length > 0) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">LIVE WIND SENSORS <span class="badge-hw">HARDWARE</span></div>`;
    for (const s of windSensors.slice(0, 3)) {
      html += `<div class="sensor-row"><span class="sense-verb">[${escHtml(s.source.toUpperCase())}]</span> <span class="sense-value">${escHtml(s.name)} (${s.distance_km}km)</span></div>`;
      if (s.wind_speed_kmh != null) {
        // Always convert using the unit helper
        html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">${cWind(s.wind_speed_kmh)} ${uL('wind')}`;
        if (s.wind_direction != null) html += ` from ${s.wind_direction}°`;
        if (s.wind_gust_kmh != null) html += ` (gusts ${cWind(s.wind_gust_kmh)})`;
        html += `</span></div>`;
      }
    }
    if (ext.wind_cross_reference) {
      const xr = ext.wind_cross_reference;
      html += `<div class="sensor-row" style="margin-top:6px"><span class="sense-verb">Cross-ref:</span> <span class="sense-value">${xr.sensor_count} sensors avg ${cWind(xr.average_kmh)} ${uL('wind')} (${cWind(xr.min_kmh)}-${cWind(xr.max_kmh)})</span></div>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="sensor-section"><div class="sensor-section-title">LIVE WIND SENSORS</div><div class="sensor-row"><span class="sense-value" style="color:var(--text2)">No sensors nearby. Using model data.</span></div></div>`;
  }

  // ── EXTENDED: Ocean Buoys ──
  const buoys = ext.buoys || [];
  if (buoys.length > 0) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">OCEAN BUOY <span class="badge-hw">HARDWARE</span></div>`;
    for (const b of buoys.slice(0, 2)) {
      html += `<div class="sensor-row"><span class="sense-verb">Buoy ${escHtml(b.station_id)}:</span> <span class="sense-value">${escHtml(b.name)} (${b.distance_km}km)</span></div>`;
      if (b.wave_height_m != null) html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">Waves: ${cWave(b.wave_height_m)} ${uL('wave')} (${b.wave_period_s}s)</span></div>`;
      if (b.water_temp_c != null) html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">Water: ${cTemp(b.water_temp_c)}${uL('temp')}</span></div>`;
      if (b.pressure_hpa != null) html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">Pressure: ${cPress(b.pressure_hpa)} ${uL('press')}</span></div>`;
    }
    html += `</div>`;
  }

  // ── EXTENDED: Water Temperature sensors ──
  const waterTemps = ext.water_temperature || [];
  if (waterTemps.length > 0) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">WATER TEMP <span class="badge-hw">HARDWARE</span></div>`;
    for (const w of waterTemps.slice(0, 2)) {
      const waterTemp = w.water_temp_c != null ? w.water_temp_c : w.temp_c;
      html += `<div class="sensor-row"><span class="sense-verb">${escHtml(w.name || 'Station')}:</span> <span class="sense-value">${cTemp(waterTemp)}${uL('temp')} (${w.distance_km}km)</span></div>`;
    }
    html += `</div>`;
  }

  // ── EXTENDED: Tides ──
  const tides = ext.tides;
  if (tides) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">TIDE <span class="badge-hw">HARDWARE</span></div>
      <div class="sensor-row"><span class="sense-verb">Station:</span> <span class="sense-value">${escHtml(tides.name)} (${tides.distance_km}km)</span></div>`;
    if (tides.current_level_m != null) html += `<div class="sensor-row"><span class="sense-verb">Level:</span> <span class="sense-value">${cElev(tides.current_level_m)} ${uL('elev')} MLLW</span></div>`;
    if (tides.next_high) html += `<div class="sensor-row"><span class="sense-verb">Next high:</span> <span class="sense-value">${escHtml(tides.next_high.time)} (${cElev(tides.next_high.height_m)} ${uL('elev')})</span></div>`;
    if (tides.next_low) html += `<div class="sensor-row"><span class="sense-verb">Next low:</span> <span class="sense-value">${escHtml(tides.next_low.time)} (${cElev(tides.next_low.height_m)} ${uL('elev')})</span></div>`;
    html += `</div>`;
  }

  // ── EXTENDED: Space Weather ──
  const space = ext.space_weather;
  if (space) {
    const kp = space.kp_index;
    const kpLabel = kp == null ? 'N/A' : kp < 3 ? `Kp ${kp} (Quiet)` : kp < 5 ? `Kp ${kp} (Unsettled)` : `Kp ${kp} STORM`;
    const kpColor = kp >= 5 ? 'var(--yellow)' : 'inherit';
    html += `<div class="sensor-section">
      <div class="sensor-section-title">SPACE WEATHER</div>
      <div class="sensor-row"><span class="sense-verb">Geomagnetic:</span> <span class="sense-value" style="color:${kpColor}">${escHtml(kpLabel)}</span></div>`;
    if (space.aurora_visibility) html += `<div class="sensor-row"><span class="sense-value" style="color:var(--green)">Aurora possible — ${escHtml(space.aurora_visibility)}</span></div>`;
    if (space.solar_wind_speed) html += `<div class="sensor-row"><span class="sense-verb">Solar wind:</span> <span class="sense-value">${space.solar_wind_speed} km/s</span></div>`;
    html += `</div>`;
  }

  // ── EXTENDED: Natural Events ──
  const events = ext.natural_events || [];
  if (events.length > 0) {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">NATURAL EVENTS</div>`;
    for (const e of events.slice(0, 3)) {
      html += `<div class="sensor-row"><span class="sense-value" style="color:var(--yellow)">${escHtml(e.title || e.type)} (${e.distance_km || '?'}km)</span></div>`;
    }
    html += `</div>`;
  }

  // ── EXTENDED: Volcanoes ──
  const volcanoes = ext.volcanoes || [];
  const activeVolcanoes = volcanoes.filter(v => v.alert_level && v.alert_level !== 'Normal');
  if (activeVolcanoes.length > 0) {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">VOLCANOES</div>`;
    for (const v of activeVolcanoes.slice(0, 2)) {
      html += `<div class="sensor-row"><span class="sense-value" style="color:var(--red)">${escHtml(v.name)} — ${escHtml(v.alert_level)} (${v.distance_km}km)</span></div>`;
    }
    html += `</div>`;
  }

  // ── EXTENDED: Radiation ──
  const radiation = ext.radiation || [];
  if (radiation.length > 0) {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">RADIATION</div>`;
    for (const r of radiation.slice(0, 2)) {
      html += `<div class="sensor-row"><span class="sense-verb">${escHtml(r.name || 'Sensor')}:</span> <span class="sense-value">${r.value} ${escHtml(r.unit || 'cpm')} (${r.distance_km}km)</span></div>`;
    }
    html += `</div>`;
  }

  // ── EXTENDED: Seismic ──
  const quakes = ext.earthquakes || [];
  html += `<div class="sensor-section">
    <div class="sensor-section-title">SEISMIC</div>`;
  if (quakes.length > 0) {
    for (const q of quakes.slice(0, 2)) {
      html += `<div class="sensor-row"><span class="sense-value" style="color:var(--yellow)">M${q.magnitude} — ${q.distance_km}km away</span></div>`;
    }
  } else {
    html += `<div class="sensor-row"><span class="sense-value">No activity within 500km</span></div>`;
  }
  html += `</div>`;

  // ── EXTENDED: Fires ──
  const fires = ext.fires || [];
  html += `<div class="sensor-section">
    <div class="sensor-section-title">FIRES</div>`;
  if (fires.length > 0) {
    html += `<div class="sensor-row"><span class="sense-value" style="color:var(--red)">${fires.length} active fire(s) within 100km</span></div>`;
  } else {
    html += `<div class="sensor-row"><span class="sense-value">No fires within 100km</span></div>`;
  }
  html += `</div>`;

  // ── System Health Monitor ──
  const healthData = state.health || [];
  if (healthData.length > 0) {
    html += `<div class="sensor-section" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;margin-top:12px">
      <div class="sensor-section-title">SYSTEM HEALTH</div>`;
    for (const h of healthData) {
      const statusLabel = h.status === 'ok' && h.has_data ? 'OK' : h.status === 'ok' ? 'NO DATA' : 'ERROR';
      const latColor = h.latency_ms < 500 ? 'var(--green)' : h.latency_ms < 2000 ? 'var(--yellow)' : 'var(--red)';
      html += `<div class="sensor-row" style="display:flex;justify-content:space-between;padding-right:8px">
        <span>${statusLabel} ${escHtml(h.source.replace(/_/g,' '))}</span>
        <span style="color:${latColor};font-size:11px">${h.latency_ms}ms</span>
      </div>`;
    }
    html += `</div>`;
  }

  feed.innerHTML = html;

  // Staleness indicator
  const ts = document.getElementById('sensorTimestamp');
  if (ts) {
    const stale = stalenessLabel();
    ts.textContent = `Data fetched ${stale}`;
    if (stale && !stale.includes('just now') && parseInt(stale) > 15) {
      ts.style.color = 'var(--yellow)';
      ts.textContent += ' — consider reconnecting for fresh data';
    }
  }
}

// ─── Chat ───────────────────────────────────────────────────────────
function addSystemMessage(text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addUserMessage(text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg user';
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  updateDemoGuide();
}

function usePrompt(text) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.value = text;
  if (state.connected) {
    sendMessage();
  } else {
    focusDemoStep(state.lat === null ? 'location' : 'connect');
  }
}

function addAiMessage(htmlContent) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg ai';
  const providerName = state.provider === 'openai' ? 'GPT-4o' : 'Claude';
  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = providerName + ' + Physical World Model';
  div.appendChild(label);
  const body = document.createElement('div');
  body.innerHTML = htmlContent; // htmlContent is already sanitized via renderMarkdown
  div.appendChild(body);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addAiError(message) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg ai';
  const providerName = state.provider === 'openai' ? 'GPT-4o' : 'Claude';
  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = providerName;
  const p = document.createElement('p');
  p.style.color = 'var(--red)';
  p.textContent = message; // textContent = no XSS
  div.appendChild(label);
  div.appendChild(p);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'typing';
  div.id = 'typingIndicator';
  div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div><span class="typing-text">Sensing the Physical World Model...</span>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !state.connected) return;

  input.value = '';
  addUserMessage(text);
  state.messages.push({ role: 'user', content: text });

  // Trim history to prevent context overflow (keep last MAX_MESSAGES)
  if (state.messages.length > MAX_MESSAGES) {
    state.messages = state.messages.slice(-MAX_MESSAGES);
  }

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  showTyping();

  try {
    const body = {
      messages: state.messages,
      lat: state.lat,
      lng: state.lng,
      units: state.units,
      field: state.field,
      provider: state.provider === 'demo' ? 'anthropic' : state.provider
    };
    if (state.provider !== 'demo') body.apiKey = state.apiKey;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    removeTyping();

    if (data.error) {
      addAiError(data.error);
    } else {
      state.messages.push({ role: 'assistant', content: data.answer });
      addAiMessage(renderMarkdown(data.answer));

      if (data.sensors) {
        state.sensors = data.sensors;
        state.satellite = data.satellite;
        state.extended = data.extended || state.extended;
        state.activeSources = data.active_sources || state.activeSources;
        // Don't update pwmFetchedAt here — data came from server cache, not fresh fetch
        renderSensorFeed();
      }
    }
  } catch (e) {
    removeTyping();
    addAiError('Connection error: ' + e.message);
  }

  btn.disabled = false;
  input.focus();
}

// ─── Ticker ─────────────────────────────────────────────────────────
async function loadTicker() {
  try {
    const res = await fetch('/api/conditions');
    const conditions = await res.json();
    const track = document.getElementById('tickerTrack');
    if (!track) return;

    const items = conditions.map(c => {
      const wind = c.wind_speed != null ? `${c.wind_speed}km/h` : '--';
      const temp = c.temperature != null ? `${c.temperature}°C` : '';
      const wave = c.wave_height != null ? `${c.wave_height}m waves` : '';
      const warn = (c.wave_height && c.wave_height > 3) ? ' high waves' : '';
      const detail = wave || temp; // show waves for ocean, temp for land
      return `<span><span class="spot-name">${escHtml(c.name)}</span> ${escHtml(wind)} ${escHtml(detail)}${warn}</span>`;
    }).join('');

    track.innerHTML = items + items; // duplicate for seamless scroll
    document.getElementById('ticker').classList.remove('hidden');
  } catch (e) {
    console.error('Ticker error:', e);
  }
}

// ─── Markdown renderer ──────────────────────────────────────────────
// Escape HTML first, THEN apply markdown — prevents XSS from AI responses.
function renderMarkdown(text) {
  // Step 1: escape all HTML special chars in the raw text
  let html = escHtml(text);

  // Step 2: apply markdown patterns (these introduce safe, controlled HTML tags)
  html = html
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Step 3: wrap adjacent <li> items in <ul>
  html = html.replace(/((?:<li>.*?<\/li>(?:<br>)?)+)/g, '<ul>$1</ul>');
  html = html.replace(/<br><\/ul>/g, '</ul>');
  html = html.replace(/<ul><br>/g, '<ul>');

  return '<p>' + html + '</p>';
}
