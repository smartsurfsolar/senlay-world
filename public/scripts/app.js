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
  riskAssessment: null,
  riskSummary: null,
  riskEvents: [],
  layerContext: null,
  layerCatalog: null,
  searchResults: [],
  activeSources: 5,
  spots: [],
  units: 'metric',
  field: 'drone',
  profileSessionToken: '',
  profileLlmKeys: [],
  profileDefaultKey: null,
  profileLoaded: false,
  pwmFetchedAt: null  // timestamp of last sensor data fetch
};

let layerMap = null;
let layerMapReady = false;
let layerMapMode = 'all';
let layerMapFailed = false;
let layerMapBaseConfig = null;
let layerMapBaseConfigLoaded = false;
let layerMapBaseConfigPromise = null;

const MAX_MESSAGES = 20; // trim conversation history to last N messages
const API_KEY_STORAGE_KEY = 'senlay_apikey';
const LOCATION_STORAGE_KEY = 'senlay_location';
const API_KEY_REMEMBER_KEY = 'senlay_apikey_remember';
const SESSION_TOKEN_STORAGE_KEY = 'senlay_session_token';
const LOCAL_SOURCE_LIMITS_KM = {
  wind: 35,
  buoy: 60,
  ship: 30,
  water: 30,
  air: 30,
  community: 30,
  webcam: 30
};
const FREE_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const ENABLE_GOOGLE_TILE_BASEMAP = false;
const TERRARIUM_DEM_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const NASA_GIBS_TRUE_COLOR_LAYER = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';
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

const QUICK_PROMPTS = {
  drone: [
    ['Drone go/no-go', 'Can a drone safely fly here now? Give a go/no-go answer and explain the physical evidence.'],
    ['Can a drone fly safely now?', 'Can a drone fly safely now? Use source evidence, freshness, gust spread, visibility, precipitation, and terrain exposure.'],
    ['Wind + gust risk', 'Are wind, gusts, visibility, and precipitation within a safe drone operating margin here now?'],
    ['Next flight window', 'What is the best practical drone flight window in the next hour, and what should I watch?'],
    ['Launch site risk', 'Is this launch site exposed to terrain turbulence, rotor, buildings, wires, or local wind acceleration?'],
    ['Return margin', 'Do current wind, gusts, and battery-return margin create a risk for the flight back?'],
    ['Pilot checklist', 'Give me a short drone pilot checklist for this location and current physical conditions.']
  ],
  kitesurfing: [
    ['Kite go/no-go', 'Is this spot safe for kitesurfing right now? Give a go/no-go answer with wind, gusts, waves, and uncertainty.'],
    ['Can I kite safely now?', 'Can I kite safely now? Explain wind direction, gust factor, waves, tide/current risk, source freshness, and confidence.'],
    ['Can a beginner kite here today?', 'Can a beginner kite here today, or are conditions only suitable for experienced riders? Explain the evidence.'],
    ['Airport wind reliable?', 'Is wind from the airport reliable for this beach, or does local terrain/coastline exposure make it uncertain?'],
    ['Is gust risk elevated?', 'Is gust risk elevated right now? Compare sustained wind, gusts, gust factor, and hardware/model confidence.'],
    ['Gust + wind angle', 'How risky are the current wind direction and gusts for kitesurfing at this beach?'],
    ['Next session call', 'What is the practical kitesurfing action for the next hour: ride, wait, change kite size, or avoid?'],
    ['Kite size hint', 'Based on wind speed, gusts, and trend, what kite-size direction would be conservative?'],
    ['Beginner safety', 'Would this be safe for a beginner lesson now, or only for experienced riders?'],
    ['Rescue/drift risk', 'What is the drift or rescue risk if someone loses the board or kite here right now?']
  ],
  sailing: [
    ['Sailing go/no-go', 'Is it safe to sail here right now? Explain wind, gusts, waves, swell, and visibility.'],
    ['Wave/current risk', 'Is this location exposed to wave or current risk right now? Explain source evidence, confidence, and uncertainty.'],
    ['Sea state check', 'How challenging is the current sea state for a small boat, and what is the main risk?'],
    ['Next hour route', 'What should a sailor do in the next hour based on wind, waves, tide, and weather?'],
    ['Reefing call', 'Should a small sailboat reef or reduce sail based on wind and gust spread?'],
    ['Harbor exit', 'Is it sensible to leave harbor now, or are entrance/nearshore conditions risky?'],
    ['Crew comfort', 'Will conditions be comfortable for casual crew, or more suitable for experienced sailors?']
  ],
  fishing: [
    ['Fishing conditions', 'Are conditions good and safe for fishing here now? Explain wind, waves, tide, and weather.'],
    ['Boat comfort', 'Will a small fishing boat be comfortable or risky in the current sea state?'],
    ['Next hour plan', 'What is the practical fishing plan for the next hour based on marine conditions?'],
    ['Shore casting', 'Are wind direction, waves, and tide favorable for shore fishing here now?'],
    ['Return safety', 'If leaving by small boat, what return risk could build over the next hour?'],
    ['Weather window', 'Is there a useful fishing weather window, or should I wait for calmer conditions?']
  ],
  agriculture: [
    ['Field work call', 'Are conditions good for field work right now? Consider heat, wind, rain, soil and crop stress signals.'],
    ['Irrigation check', 'Is irrigation likely needed today based on temperature, humidity, wind, rain, and ET0 signals?'],
    ['Spray risk', 'Is it safe to spray now, or is wind, rain, or heat making drift/evaporation too risky?'],
    ['Heat stress', 'Is there crop or worker heat-stress risk in this field right now?'],
    ['Rain timing', 'Should field work wait because of rain, humidity, or storm risk?'],
    ['Soil moisture clue', 'What do current weather and recent conditions imply about soil moisture stress?']
  ],
  construction: [
    ['Worksite go/no-go', 'Are conditions safe for outdoor construction work here now? Explain wind, heat, rain, and visibility risks.'],
    ['Should outdoor work continue?', 'Should outdoor work continue here now? Consider wind, heat, rain, visibility, air quality, lightning risk, and uncertainty.'],
    ['Crane/wind check', 'Are wind and gusts a concern for lifting, scaffolding, or elevated work right now?'],
    ['Next hour work plan', 'What should the site crew do in the next hour based on weather and environmental risk?'],
    ['Heat/rest breaks', 'Do temperature, humidity, and sun exposure suggest heat-rest adjustments for workers?'],
    ['Dust/air quality', 'Is dust, PM2.5, wind, or air quality a concern for outdoor work today?'],
    ['Secure materials', 'Should the crew secure loose materials, signage, lifts, or temporary structures now?']
  ],
  hiking: [
    ['Trail safety', 'Is this trail area safe for hiking right now? Explain weather, heat/cold, wind, rain, and terrain risk.'],
    ['Exposure check', 'What is the main exposure risk for hikers here now: heat, wind, storm, visibility, or terrain?'],
    ['Next hour trail plan', 'What should hikers do in the next hour based on current conditions?'],
    ['Storm turnback', 'Is there any sign that hikers should turn back because of storm, wind, or visibility risk?'],
    ['Layer/water hint', 'What clothing, water, or sun-protection adjustment makes sense for this hike now?'],
    ['Ridge risk', 'Would exposed ridges, cliffs, or open terrain be riskier than sheltered trail sections?']
  ],
  paragliding: [
    ['Paragliding go/no-go', 'Is it safe to paraglide here now? Explain wind, gusts, thermals, turbulence, and visibility.'],
    ['Launch risk', 'How risky are the current wind direction, gusts, and terrain effects for launch?'],
    ['Next flight window', 'What is the practical paragliding call for the next hour: fly, wait, relocate, or stop?'],
    ['Thermal strength', 'Are thermals likely smooth, strong, broken, or risky based on sun, wind, humidity, and terrain?'],
    ['Landing margin', 'How much landing risk is created by gusts, wind direction, turbulence, or terrain exposure?'],
    ['Pilot level', 'Would these conditions suit students, intermediate pilots, experts only, or nobody?']
  ],
  events: [
    ['Event safety', 'Are conditions safe for an outdoor event here now? Explain wind, rain, heat, air quality, and storm risk.'],
    ['Tent/stage risk', 'Are wind, gusts, or precipitation a concern for tents, signage, stages, or crowds right now?'],
    ['Next hour ops', 'What should event staff do in the next hour based on current physical conditions?'],
    ['Crowd comfort', 'Will heat, humidity, wind, rain, or air quality affect crowd comfort now?'],
    ['Delay/continue', 'Should an outdoor event continue, delay, reduce setup, or move indoors?'],
    ['Staff checklist', 'Give event staff a short weather safety checklist for the next hour.']
  ],
  general: [
    ['Risk summary', 'What are the main physical-world risks at this place right now?'],
    ['What data is missing?', 'What data is missing or uncertain for this location, and how should that affect the recommendation?'],
    ['Evidence check', 'Which values are measured by sensors, which are forecast/model data, and how fresh are they?'],
    ['Next hour action', 'Give me the practical action for the next hour based on weather, air quality, terrain, and local risk.'],
    ['Sensor trust', 'Which source should I trust most here, and what uncertainty remains?'],
    ['Model mismatch', 'Are live sensors and model data disagreeing in any important way?'],
    ['Human decision', 'Turn this physical context into one clear human decision for the next hour.']
  ]
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

function safeExternalHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch (_) {
    return null;
  }
}

function setConnectionStatus(element, className, message) {
  if (!element) return;
  element.className = `conn-status ${className}`;
  element.replaceChildren();
  const dot = document.createElement('span');
  dot.className = 'conn-dot';
  dot.setAttribute('aria-hidden', 'true');
  element.append(dot, document.createTextNode(` ${message}`));
}

function sourceBadge(sourceInfo, modelLabel = 'MODEL', current = null) {
  const mode = sourceInfo?.mode;
  const hasCurrentValue = current && Object.entries(current)
    .some(([key, value]) => key !== 'time' && value !== null && value !== undefined && value !== '');
  if (mode === 'hardware_only') return '<span class="badge-hw">HARDWARE</span>';
  if (mode === 'hardware_with_model_fallback') return '<span class="badge-hw">HARDWARE-ANCHORED</span>';
  if (!mode || (mode === 'model_only' && current && !hasCurrentValue)) {
    return '<span class="badge-model">DATA UNAVAILABLE</span>';
  }
  return `<span class="badge-model">${modelLabel}</span>`;
}

function humanizeSourceField(field) {
  return SOURCE_FIELD_LABELS[field] || field.replace(/_/g, ' ');
}

function sourceObservationSummaries(sourceInfo, limit = 4) {
  const grouped = new Map();
  for (const [field, source] of Object.entries(sourceInfo?.field_sources || {})) {
    if (!source) continue;
    const observedAt = source.observed_at || null;
    const suppliedAgeValue = source.freshness?.age_minutes;
    const suppliedAge = suppliedAgeValue == null ? null : Number(suppliedAgeValue);
    const parsed = Date.parse(observedAt || '');
    const calculatedAge = Number.isFinite(parsed) ? (Date.now() - parsed) / 60000 : null;
    const age = Number.isFinite(suppliedAge) ? suppliedAge : calculatedAge;
    if (!observedAt && !Number.isFinite(age)) continue;
    const key = `${observedAt || ''}|${Number.isFinite(age) ? Math.round(age) : ''}`;
    if (!grouped.has(key)) grouped.set(key, { fields: [], observedAt, age });
    grouped.get(key).fields.push(humanizeSourceField(field));
  }
  return [...grouped.values()].slice(0, limit).map(item => {
    const ageText = Number.isFinite(item.age)
      ? item.age < -1
        ? 'timestamp is in the future'
        : item.age < 1
          ? 'less than 1 min old'
          : `${Math.round(item.age)} min old`
      : 'age unknown';
    const timestampText = item.observedAt ? ` at ${item.observedAt}` : '';
    return `${item.fields.join(', ')}: ${ageText}${timestampText}`;
  });
}

function sourceSummary(sourceInfo, current = null) {
  const hasCurrentValue = current && Object.entries(current)
    .some(([key, value]) => key !== 'time' && value !== null && value !== undefined && value !== '');
  if (!sourceInfo || (sourceInfo.mode === 'model_only' && current && !hasCurrentValue)) {
    return 'Current source data unavailable; values are unknown';
  }
  if (sourceInfo.mode === 'model_only') {
    return 'Model-derived current conditions';
  }
  const fields = (sourceInfo.overridden_fields || []).map(humanizeSourceField);
  const firstKey = Object.keys(sourceInfo.field_sources || {})[0];
  const firstSource = firstKey ? sourceInfo.field_sources[firstKey] : null;
  const sourceName = firstSource?.name || firstSource?.source || 'nearby hardware sensor';
  const distance = firstSource?.distance_km != null ? ` ${firstSource.distance_km}km away` : '';
  const fieldText = fields.length ? ` for ${fields.join(', ')}` : '';
  const modeText = sourceInfo.mode === 'hardware_only' ? 'Hardware-observed' : 'Hardware-anchored';
  return `${modeText}${fieldText} via ${sourceName}${distance}`;
}

function trustColor(trust) {
  if (trust === 'high') return 'var(--green)';
  if (trust === 'moderate') return 'var(--yellow)';
  if (trust === 'low') return 'var(--red)';
  return 'var(--text2)';
}

function severityLabel(severity) {
  if (severity === 'major') return 'DIVERGING';
  if (severity === 'minor') return 'WATCH';
  return 'AGREE';
}

function agreementValue(item, value) {
  if (value == null) return '--';
  if (item.field === 'wind_speed' || item.field === 'wind_gust') return `${cWind(value)} ${uL('wind')}`;
  if (item.field === 'wind_direction') return `${Math.round(value)}°`;
  if (item.field === 'temperature' || item.field === 'water_temperature') return `${cTemp(value)}${uL('temp')}`;
  if (item.field === 'wave_height') return `${cWave(value)} ${uL('wave')}`;
  if (item.field === 'pressure') return `${cPress(value)} ${uL('press')}`;
  return `${value}${item.units ? ' ' + item.units : ''}`;
}

function agreementDelta(item) {
  const raw = item.field === 'wind_direction' ? item.abs_delta : item.delta;
  if (raw == null) return 'Δ--';
  const sign = item.field === 'wind_direction' || raw === 0 ? '' : raw > 0 ? '+' : '-';
  const abs = Math.abs(raw);
  if (item.field === 'wind_speed' || item.field === 'wind_gust') return `Δ${sign}${cWind(abs)} ${uL('wind')}`;
  if (item.field === 'wind_direction') return `Δ${Math.round(abs)}°`;
  if (item.field === 'temperature' || item.field === 'water_temperature') {
    const converted = state.units === 'imperial' ? Math.round(abs * 9 / 5 * 10) / 10 : Math.round(abs * 10) / 10;
    return `Δ${sign}${converted}${uL('temp')}`;
  }
  if (item.field === 'wave_height') return `Δ${sign}${cWave(abs)} ${uL('wave')}`;
  if (item.field === 'pressure') return `Δ${sign}${cPress(abs)} ${uL('press')}`;
  return `Δ${sign}${abs}${item.units ? ' ' + item.units : ''}`;
}

function renderForecastAgreement(agreement) {
  if (!agreement) return '';
  const trust = agreement.forecast_trust || 'unknown';
  const primary = agreement.primary_sensor;
  const primaryName = primary?.name || primary?.source || 'nearest available hardware';
  const primaryDistance = primary?.distance_km != null ? ` (${primary.distance_km}km)` : '';
  const trustText = `${trust.toUpperCase()}${agreement.score != null ? ` ${agreement.score}/100` : ''}`;
  let html = `<div class="sensor-section hw-border">
    <div class="sensor-section-title">FORECAST TRUST <span class="badge-hw" style="color:${trustColor(trust)}">${escHtml(trustText)}</span></div>
    <div class="sensor-row"><span class="sense-verb">Anchor:</span> <span class="sense-value">${escHtml(primaryName + primaryDistance)}</span></div>
    <div class="sensor-row"><span class="sense-verb">Rule:</span> <span class="sense-value">nearest hardware first; farther stations compare only</span></div>`;

  for (const item of (agreement.comparisons || []).slice(0, 4)) {
    const color = trustColor(item.severity === 'major' ? 'low' : item.severity === 'minor' ? 'moderate' : 'high');
    html += `<div class="sensor-row"><span class="sense-verb">${escHtml(item.label)}:</span> <span class="sense-value">${agreementValue(item, item.hardware_value)} hw vs ${agreementValue(item, item.model_value)} model <span style="color:${color}">${escHtml(severityLabel(item.severity))} ${escHtml(agreementDelta(item))}</span></span></div>`;
  }

  if (agreement.model_trend) {
    const t = agreement.model_trend;
    html += `<div class="sensor-row"><span class="sense-verb">Trend:</span> <span class="sense-value">model wind ${escHtml(t.direction)} ${cWind(t.current_model_kmh)} -> ${cWind(t.future_model_kmh)} ${uL('wind')} over ${t.horizon_hours}h</span></div>`;
  }

  const comparisonSensors = agreement.comparison_sensors || [];
  if (comparisonSensors.length > 0) {
    const labels = comparisonSensors.slice(0, 3).map(sensor => {
      const delta = sensor.delta_from_primary_kmh == null ? '' : `, ${agreementDelta({ field: 'wind_speed', delta: sensor.delta_from_primary_kmh })}`;
      const distance = sensor.distance_km != null ? ` ${sensor.distance_km}km` : '';
      return `${sensor.name || sensor.source}${distance}${delta}`;
    });
    html += `<div class="sensor-row"><span class="sense-verb">Compare:</span> <span class="sense-value">${escHtml(labels.join(' | '))}</span></div>`;
  }

  html += `</div>`;
  return html;
}

function riskLevelColor(level) {
  if (level === 'critical' || level === 'high') return 'var(--red)';
  if (level === 'medium') return 'var(--yellow)';
  if (!level || level === 'unknown') return 'var(--text2)';
  return 'var(--green)';
}

function layerMapRiskColor(level) {
  if (level === 'critical' || level === 'high') return '#ff6f61';
  if (level === 'medium' || level === 'moderate') return '#ffd36a';
  return '#18d39a';
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function firstFinite(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function destinationPoint(lng, lat, bearingDeg, distanceKm) {
  const radiusKm = 6371;
  const bearing = bearingDeg * Math.PI / 180;
  const lat1 = lat * Math.PI / 180;
  const lng1 = lng * Math.PI / 180;
  const angular = distanceKm / radiusKm;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular)
    + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
    Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
  );
  return [lng2 * 180 / Math.PI, lat2 * 180 / Math.PI];
}

function circleCoordinates(lng, lat, radiusKm, segments = 96) {
  const coords = [];
  for (let i = 0; i <= segments; i++) {
    coords.push(destinationPoint(lng, lat, (i / segments) * 360, radiusKm));
  }
  return coords;
}

function normalizeBearing(value) {
  if (value == null || value === '') return null;
  const bearing = Number(value);
  if (!Number.isFinite(bearing)) return null;
  return ((bearing % 360) + 360) % 360;
}

function bearingOffset(bearingDeg, offsetDeg) {
  const bearing = normalizeBearing(bearingDeg);
  return bearing == null ? null : normalizeBearing(bearing + offsetDeg);
}

function corridorCoordinates(lng, lat, bearingDeg, lengthKm, widthKm, startKm = 0) {
  const bearing = normalizeBearing(bearingDeg);
  if (bearing == null) return [];
  const startDistance = clampNumber(startKm, 0, lengthKm);
  const endDistance = Math.max(startDistance + 0.2, lengthKm);
  const halfWidth = clampNumber(widthKm / 2, 0.08, 2);
  const startCenter = destinationPoint(lng, lat, bearing, startDistance);
  const endCenter = destinationPoint(lng, lat, bearing, endDistance);
  const leftBearing = bearingOffset(bearing, -90);
  const rightBearing = bearingOffset(bearing, 90);
  const topLeft = destinationPoint(startCenter[0], startCenter[1], leftBearing, halfWidth);
  const farLeft = destinationPoint(endCenter[0], endCenter[1], leftBearing, halfWidth);
  const farRight = destinationPoint(endCenter[0], endCenter[1], rightBearing, halfWidth);
  const topRight = destinationPoint(startCenter[0], startCenter[1], rightBearing, halfWidth);
  return [topLeft, farLeft, farRight, topRight, topLeft];
}

function sectorCoordinates(lng, lat, bearingDeg, radiusKm, angleDeg = 58, segments = 14) {
  const bearing = normalizeBearing(bearingDeg);
  if (bearing == null) return [];
  const angle = clampNumber(angleDeg, 18, 110);
  const radius = clampNumber(radiusKm, 0.4, 8);
  const start = bearing - (angle / 2);
  const coords = [[lng, lat]];
  for (let i = 0; i <= segments; i++) {
    coords.push(destinationPoint(lng, lat, start + ((angle * i) / segments), radius));
  }
  coords.push([lng, lat]);
  return coords;
}

function addRiskAreaFeature(features, coordinates, label, color, labelPoint, opacity = 0.22) {
  if (!Array.isArray(coordinates) || coordinates.length < 4) return;
  features.push({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coordinates] },
    properties: {
      kind: 'risk_area',
      color,
      label,
      opacity
    }
  });
  if (Array.isArray(labelPoint) && labelPoint.length === 2) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: labelPoint },
      properties: {
        kind: 'risk_area_label',
        color,
        label
      }
    });
  }
}

function addRiskSpotFeature(features, coordinates, label, color, radius = 5.5) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return;
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: {
      kind: 'risk_spot',
      color,
      label,
      radius
    }
  });
}

function profileSpreadMeters(profile) {
  if (!Array.isArray(profile) || profile.length < 2) return 0;
  const values = profile.map(Number).filter(Number.isFinite);
  if (values.length < 2) return 0;
  return Math.max(...values) - Math.min(...values);
}

function coordinateFromSource(source) {
  if (!source || typeof source !== 'object') return null;
  const lat = firstFinite(
    source.lat,
    source.latitude,
    source.station_lat,
    source.station_latitude,
    source.location?.lat,
    source.coordinates?.lat,
    Array.isArray(source.coordinates) ? source.coordinates[1] : null
  );
  const lng = firstFinite(
    source.lng,
    source.lon,
    source.longitude,
    source.station_lng,
    source.station_lon,
    source.station_longitude,
    source.location?.lng,
    source.location?.lon,
    source.coordinates?.lng,
    source.coordinates?.lon,
    Array.isArray(source.coordinates) ? source.coordinates[0] : null
  );
  if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function compactMapLabel(value, fallback) {
  const label = String(value || fallback || '').trim().replace(/\s+/g, ' ');
  return label.length > 28 ? `${label.slice(0, 25)}...` : label;
}

function sourceMapLabel(sourceType, item) {
  const sourceName = compactMapLabel(item?.name || item?.station_id || item?.source, sourceType);
  const prefix = {
    wind: 'Wind',
    buoy: 'Buoy',
    ship: 'Ship',
    water: 'Water',
    air: 'Air',
    community: 'Sensor'
  }[sourceType] || 'Sensor';
  return `${prefix}: ${sourceName}`;
}

function sourceDistanceKm(item) {
  if (item?.distance_km == null || item.distance_km === '') return null;
  const distance = Number(item?.distance_km);
  return Number.isFinite(distance) ? distance : null;
}

function sourceHasErrorStatus(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.error === true) return true;
  if (typeof item.error === 'string' && item.error.trim()) return true;
  if (item.error && typeof item.error === 'object') return true;
  const statuses = [
    item.status,
    item.source_status,
    item.health_status,
    item.availability,
    item.state
  ].map(value => String(value || '').trim().toLowerCase().replace(/\s+/g, '_'));
  return statuses.some(status =>
    status === 'error'
    || status === 'failed'
    || status === 'failure'
    || status === 'timeout'
    || status === 'timed_out'
    || status === 'unauthorized'
    || status === 'forbidden'
    || status === 'denied'
    || status === 'blocked'
    || status === 'auth_error'
    || status === 'http_error'
    || status === 'rate_limited'
    || /^http_\d{3}$/.test(status)
    || status.endsWith('_error')
  );
}

function sourceHealthEntry(source) {
  return (state.health || []).find(item => item?.source === source) || null;
}

function emptyFeedMessage(source, availableMessage, unavailableMessage) {
  const health = sourceHealthEntry(source);
  const status = String(health?.status || '').trim().toLowerCase();
  if (status === 'error') return unavailableMessage;
  if (status === 'not_applicable') return `${unavailableMessage} The integration is not configured or does not apply here.`;
  if (!health) return `${unavailableMessage} Feed status is unknown.`;
  return `${availableMessage} This is not a safety clearance.`;
}

function hasValidatedTerrainBathymetry(terrain) {
  return terrain?.bathymetry_available === true
    && Boolean(String(terrain.bathymetry_source || terrain.source || '').trim())
    && Boolean(String(terrain.vertical_datum || terrain.bathymetry_vertical_datum || '').trim());
}

function terrainSurfaceLabel(terrain) {
  if (!terrain || terrain.error) return 'unknown';
  if (hasValidatedTerrainBathymetry(terrain) && terrain.is_ocean === true) return 'water';
  if ((terrain.coastline_available === true || terrain.surface_classification_available === true) && terrain.is_shoreline === true) return 'shoreline';
  return String(terrain.surface_type || 'unknown').trim().toLowerCase() || 'unknown';
}

function isLocalSource(item, sourceType, fallbackLimitKm = 30) {
  if (sourceHasErrorStatus(item)) return false;
  const distance = sourceDistanceKm(item);
  if (distance == null) return true;
  const limit = LOCAL_SOURCE_LIMITS_KM[sourceType] || fallbackLimitKm;
  return distance <= limit;
}

function localSources(items, sourceType, fallbackLimitKm = 30) {
  return (Array.isArray(items) ? items : [])
    .filter(item => isLocalSource(item, sourceType, fallbackLimitKm));
}

function sourceMapFeatures() {
  const ext = state.extended || {};
  const groups = [
    ['wind', ext.wind_sensors, '#18d39a'],
    ['buoy', ext.buoys, '#55b7ff'],
    ['ship', ext.ship_observations, '#9bddff'],
    ['water', ext.usgs_water, '#59f0bf'],
    ['air', ext.air_quality_sensors, '#ffd36a'],
    ['community', ext.opensensemap, '#f1f7f4']
  ];
  const features = [];
  for (const [sourceType, items, color] of groups) {
    for (const item of localSources(items, sourceType).slice(0, 16)) {
      const coords = coordinateFromSource(item);
      if (!coords) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
        properties: {
          kind: 'sensor',
          sourceType,
          color,
          name: item.name || item.station_id || item.source || sourceType,
          label: sourceMapLabel(sourceType, item)
        }
      });
    }
  }
  return features;
}

function windDirectionConflict() {
  const comparisons = state.sensors?.forecast_agreement?.comparisons || [];
  const comparison = comparisons.find(item => item.field === 'wind_direction');
  if (!comparison) return null;
  const delta = Number(comparison.abs_delta ?? comparison.delta);
  const severe = comparison.severity === 'major' || (Number.isFinite(delta) && Math.abs(delta) >= 60);
  if (!severe) return null;
  return {
    hardware: firstFinite(comparison.hardware_value, comparison.primary_source?.wind_direction),
    model: firstFinite(comparison.model_value),
    delta: Number.isFinite(delta) ? Math.round(Math.abs(delta)) : null
  };
}

function buildLayerMapFeatures() {
  if (state.lat == null || state.lng == null || state.lat === '' || state.lng === '') {
    return { type: 'FeatureCollection', features: [] };
  }
  const lat = Number(state.lat);
  const lng = Number(state.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features = [];
  const assessment = state.riskAssessment || legacyRiskAssessment(state.riskSummary, state.riskEvents);
  const rawRiskScore = assessment?.risk_score;
  const riskScore = rawRiskScore == null ? null : Number(rawRiskScore);
  const riskLevel = assessment?.risk_level || 'unknown';
  const noFlagsOnly = assessment?.incident_state === 'no_flags_from_available_evidence';
  const riskColor = !assessment || noFlagsOnly || !Number.isFinite(riskScore) ? '#8a9692'
    : riskScore >= 60 ? '#ff6f61'
      : riskScore >= 20 ? '#ffd36a'
        : layerMapRiskColor(riskLevel);
  const current = state.sensors?.layers?.atmosphere?.current || {};
  const windSpeed = Number(current.wind_speed_10m);
  const windDirection = normalizeBearing(current.wind_direction_10m);
  const windConflict = windDirection == null ? null : windDirectionConflict();
  const downwindBearing = windDirection == null ? null : bearingOffset(windDirection, 180);

  if (windConflict) {
    [
      { label: 'Hardware downwind direction (not a trajectory)', bearing: bearingOffset(windConflict.hardware, 180), color: '#ff6f61' },
      { label: 'Forecast downwind direction (not a trajectory)', bearing: bearingOffset(windConflict.model, 180), color: '#ffd36a' }
    ].forEach(item => {
      if (item.bearing == null) return;
      const end = destinationPoint(lng, lat, item.bearing, 3);
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[lng, lat], end] },
        properties: { kind: 'wind', color: item.color, speed: Number.isFinite(windSpeed) ? windSpeed : 0, label: item.label }
      });
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: end },
        properties: { kind: 'wind_head', color: item.color, speed: Number.isFinite(windSpeed) ? windSpeed : 0, label: item.label }
      });
    });
  } else if (Number.isFinite(windSpeed) && downwindBearing != null) {
    const end = destinationPoint(lng, lat, downwindBearing, 3);
    const label = `Measured downwind direction at ${Math.round(windSpeed)} km/h (not a drift trajectory)`;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[lng, lat], end] },
      properties: { kind: 'wind', color: '#55b7ff', speed: windSpeed, label }
    });
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: end },
      properties: { kind: 'wind_head', color: '#55b7ff', speed: windSpeed, label }
    });
  }

  features.push(...sourceMapFeatures());
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      kind: 'spot',
      color: riskColor,
      label: `${compactMapLabel(state.locationName, 'Selected spot')} — ${assessment && Number.isFinite(riskScore) ? `${riskLevel} risk state ${riskScore}/100` : 'risk unknown; not scored'}; not a safety clearance`
    }
  });

  return { type: 'FeatureCollection', features };
}

async function loadLayerMapBaseConfig() {
  if (layerMapBaseConfigLoaded) return layerMapBaseConfig;
  if (layerMapBaseConfigPromise) return layerMapBaseConfigPromise;
  if (!ENABLE_GOOGLE_TILE_BASEMAP) {
    layerMapBaseConfig = null;
    layerMapBaseConfigLoaded = true;
    return layerMapBaseConfig;
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;
  layerMapBaseConfigPromise = fetch('/api/map-tiles/google/session', controller ? { signal: controller.signal } : undefined)
    .then(async res => {
      if (!res.ok) return null;
      const data = await res.json();
      return data?.provider === 'google' && data.tileUrl ? data : null;
    })
    .catch(() => null)
    .then(config => {
      if (timeoutId) clearTimeout(timeoutId);
      layerMapBaseConfig = config;
      layerMapBaseConfigLoaded = true;
      layerMapBaseConfigPromise = null;
      return layerMapBaseConfig;
    });
  return layerMapBaseConfigPromise;
}

function collapseLayerMapAttribution() {
  const attribution = document.querySelector('#layerMap .maplibregl-ctrl-attrib.maplibregl-compact');
  if (attribution) attribution.classList.remove('maplibregl-compact-show');
}

function layerMapStyle() {
  if (layerMapBaseConfig?.tileUrl) {
    return {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        google: {
          type: 'raster',
          tiles: [layerMapBaseConfig.tileUrl],
          tileSize: layerMapBaseConfig.tileWidth || 256,
          attribution: layerMapBaseConfig.attribution || '&copy; Google'
        }
      },
      layers: [
        {
          id: 'google-map-tiles',
          type: 'raster',
          source: 'google',
          paint: { 'raster-opacity': 1 }
        }
      ]
    };
  }

  return FREE_MAP_STYLE_URL;
}

function mapTileCoords(lng, lat, zoom = 10) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, zoom };
}

function fallbackTileUrl() {
  if (state.lat == null || state.lng == null || state.lat === '' || state.lng === '') return '';
  const lat = Number(state.lat);
  const lng = Number(state.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const tile = mapTileCoords(lng, lat, 10);
  if (layerMapBaseConfig?.tileUrl) {
    return layerMapBaseConfig.tileUrl
      .replace('{z}', tile.zoom)
      .replace('{x}', tile.x)
      .replace('{y}', tile.y);
  }
  return '';
}

function nasaGibsDate() {
  const date = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000));
  return date.toISOString().slice(0, 10);
}

function nasaGibsTileUrl() {
  const date = nasaGibsDate();
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${NASA_GIBS_TRUE_COLOR_LAYER}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

function firstMapSymbolLayerId() {
  const layers = layerMap?.getStyle?.().layers || [];
  return layers.find(layer => layer.type === 'symbol')?.id;
}

function addFreePhysicalMapLayers() {
  if (!layerMap) return;

  try {
    if (!layerMap.getSource('senlay-terrain-dem')) {
      layerMap.addSource('senlay-terrain-dem', {
        type: 'raster-dem',
        tiles: [TERRARIUM_DEM_TILE_URL],
        tileSize: 256,
        encoding: 'terrarium',
        maxzoom: 15,
        attribution: 'Terrain: AWS Open Data'
      });
    }
    if (typeof layerMap.setTerrain === 'function') {
      layerMap.setTerrain({
        source: 'senlay-terrain-dem',
        exaggeration: layerMapMode === 'terrain' ? 1.65 : 1.15
      });
    }
  } catch (error) {
    console.warn('Senlay terrain layer unavailable:', error?.message || error);
  }

  try {
    if (!layerMap.getSource('senlay-nasa-gibs')) {
      layerMap.addSource('senlay-nasa-gibs', {
        type: 'raster',
        tiles: [nasaGibsTileUrl()],
        tileSize: 256,
        maxzoom: 9,
        attribution: 'NASA GIBS'
      });
    }
    if (!layerMap.getLayer('senlay-nasa-gibs')) {
      layerMap.addLayer({
        id: 'senlay-nasa-gibs',
        type: 'raster',
        source: 'senlay-nasa-gibs',
        layout: { visibility: 'visible' },
        paint: {
          'raster-opacity': 0.14,
          'raster-saturation': -0.25,
          'raster-contrast': 0.08
        }
      }, firstMapSymbolLayerId());
    }
  } catch (error) {
    console.warn('Senlay NASA imagery layer unavailable:', error?.message || error);
  }
}

function layerMapCamera() {
  if (layerMapMode === 'terrain') {
    return { zoom: 10.7, pitch: 48, bearing: -18 };
  }
  if (layerMapMode === 'risk') {
    return { zoom: 10.9, pitch: 8, bearing: 0 };
  }
  if (layerMapMode === 'marine') {
    return { zoom: 10.4, pitch: 24, bearing: -8 };
  }
  return { zoom: 10.35, pitch: 24, bearing: -8 };
}

function addLayerMapLayers() {
  if (!layerMap) return;
  addFreePhysicalMapLayers();
  if (layerMap.getSource('senlay-overlays')) return;
  layerMap.addSource('senlay-overlays', {
    type: 'geojson',
    data: buildLayerMapFeatures()
  });
  layerMap.addLayer({
    id: 'senlay-risk-area-fill',
    type: 'fill',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'risk_area'],
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], '#ff6f61'],
      'fill-opacity': ['to-number', ['get', 'opacity'], 0.2]
    }
  });
  layerMap.addLayer({
    id: 'senlay-risk-area-outline',
    type: 'line',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'risk_area'],
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#ff6f61'],
      'line-width': 1.8,
      'line-opacity': 0.8,
      'line-dasharray': [3, 1.5]
    }
  });
  layerMap.addLayer({
    id: 'senlay-risk-area-labels',
    type: 'symbol',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'risk_area_label'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 9.5,
      'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.55,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-max-width': 11
    },
    paint: {
      'text-color': '#702515',
      'text-halo-color': '#fff8e7',
      'text-halo-width': 1.8
    }
  });
  layerMap.addLayer({
    id: 'senlay-terrain-rings',
    type: 'line',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'terrain'],
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#ffd36a'],
      'line-width': 1.8,
      'line-opacity': 0.72,
      'line-dasharray': [2, 2]
    }
  });
  layerMap.addLayer({
    id: 'senlay-wind-line',
    type: 'line',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'wind'],
    paint: {
      'line-color': '#55b7ff',
      'line-width': 4,
      'line-opacity': 0.9
    }
  });
  layerMap.addLayer({
    id: 'senlay-sensors',
    type: 'circle',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'sensor'],
    paint: {
      'circle-color': ['coalesce', ['get', 'color'], '#f1f7f4'],
      'circle-radius': 5,
      'circle-opacity': 0.9,
      'circle-stroke-color': '#07111f',
      'circle-stroke-width': 1.5
    }
  });
  layerMap.addLayer({
    id: 'senlay-sensor-labels',
    type: 'symbol',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'sensor'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 10,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-max-width': 9
    },
    paint: {
      'text-color': '#102033',
      'text-halo-color': '#f8fafc',
      'text-halo-width': 1.7,
      'text-opacity': 0.96
    }
  });
  layerMap.addLayer({
    id: 'senlay-wind-head',
    type: 'circle',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'wind_head'],
    paint: {
      'circle-color': '#55b7ff',
      'circle-radius': 6,
      'circle-opacity': 0.95,
      'circle-stroke-color': '#f1f7f4',
      'circle-stroke-width': 1
    }
  });
  layerMap.addLayer({
    id: 'senlay-wind-head-label',
    type: 'symbol',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'wind_head'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 10,
      'text-offset': [0, 1.15],
      'text-anchor': 'top',
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': '#0b5f95',
      'text-halo-color': '#f8fafc',
      'text-halo-width': 1.7
    }
  });
  layerMap.addLayer({
    id: 'senlay-wind-conflict',
    type: 'circle',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'wind_conflict'],
    paint: {
      'circle-color': '#ffd36a',
      'circle-radius': 7,
      'circle-opacity': 0.95,
      'circle-stroke-color': '#07111f',
      'circle-stroke-width': 2
    }
  });
  layerMap.addLayer({
    id: 'senlay-wind-conflict-label',
    type: 'symbol',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'wind_conflict'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 10,
      'text-offset': [0, 1.25],
      'text-anchor': 'top',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-max-width': 14
    },
    paint: {
      'text-color': '#735000',
      'text-halo-color': '#fff8dc',
      'text-halo-width': 1.8
    }
  });
  layerMap.addLayer({
    id: 'senlay-risk-spots',
    type: 'circle',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'risk_spot'],
    paint: {
      'circle-color': ['coalesce', ['get', 'color'], '#ff6f61'],
      'circle-radius': ['to-number', ['get', 'radius'], 5.5],
      'circle-opacity': 0.95,
      'circle-stroke-color': '#fff8e7',
      'circle-stroke-width': 1.6
    }
  });
  layerMap.addLayer({
    id: 'senlay-risk-spot-labels',
    type: 'symbol',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'risk_spot'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 10,
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.85,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-max-width': 10
    },
    paint: {
      'text-color': '#702515',
      'text-halo-color': '#fff8e7',
      'text-halo-width': 1.8
    }
  });
  layerMap.addLayer({
    id: 'senlay-spot-halo',
    type: 'circle',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'spot'],
    paint: {
      'circle-color': '#18d39a',
      'circle-radius': 18,
      'circle-opacity': 0.16,
      'circle-stroke-color': '#18d39a',
      'circle-stroke-width': 1
    }
  });
  layerMap.addLayer({
    id: 'senlay-spot',
    type: 'circle',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'spot'],
    paint: {
      'circle-color': '#18d39a',
      'circle-radius': 7,
      'circle-opacity': 1,
      'circle-stroke-color': '#07111f',
      'circle-stroke-width': 2
    }
  });
  layerMap.addLayer({
    id: 'senlay-spot-label',
    type: 'symbol',
    source: 'senlay-overlays',
    filter: ['==', ['get', 'kind'], 'spot'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-offset': [0, -1.55],
      'text-anchor': 'bottom',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-max-width': 10
    },
    paint: {
      'text-color': '#102033',
      'text-halo-color': '#f8fafc',
      'text-halo-width': 2
    }
  });
}

function updateLayerMapVisibility() {
  if (!layerMapReady || !layerMap) return;
  const showAll = layerMapMode === 'all';
  const visibility = {
    'senlay-nasa-gibs': showAll || layerMapMode === 'marine' ? 'visible' : 'none',
    'senlay-risk-area-fill': showAll || layerMapMode === 'risk' ? 'visible' : 'none',
    'senlay-risk-area-outline': showAll || layerMapMode === 'risk' ? 'visible' : 'none',
    'senlay-risk-area-labels': showAll || layerMapMode === 'risk' ? 'visible' : 'none',
    'senlay-risk-spots': showAll || layerMapMode === 'risk' ? 'visible' : 'none',
    'senlay-risk-spot-labels': showAll || layerMapMode === 'risk' ? 'visible' : 'none',
    'senlay-terrain-rings': showAll || layerMapMode === 'terrain' || layerMapMode === 'marine' ? 'visible' : 'none',
    'senlay-wind-line': 'visible',
    'senlay-wind-head': 'visible',
    'senlay-wind-head-label': 'visible',
    'senlay-wind-conflict': 'visible',
    'senlay-wind-conflict-label': 'visible',
    'senlay-sensors': 'visible',
    'senlay-sensor-labels': 'visible',
    'senlay-spot-label': 'visible'
  };
  for (const [id, value] of Object.entries(visibility)) {
    if (layerMap.getLayer(id)) layerMap.setLayoutProperty(id, 'visibility', value);
  }
  if (layerMap.getLayer('senlay-nasa-gibs')) {
    layerMap.setPaintProperty('senlay-nasa-gibs', 'raster-opacity', layerMapMode === 'marine' ? 0.22 : 0.12);
  }
  if (typeof layerMap.setTerrain === 'function' && layerMap.getSource('senlay-terrain-dem')) {
    layerMap.setTerrain({
      source: 'senlay-terrain-dem',
      exaggeration: layerMapMode === 'terrain' ? 1.65 : 1.15
    });
  }
}

function updateLayerMapCamera() {
  if (!layerMapReady || !layerMap) return;
  layerMap.easeTo({
    center: [Number(state.lng), Number(state.lat)],
    ...layerMapCamera(),
    duration: 420,
    essential: true
  });
}

function updateLayerMapShell() {
  const title = document.getElementById('layerMapTitle');
  if (title) {
    const fieldLabel = FIELD_LABELS[state.field] || state.field || 'Physical context';
    title.textContent = state.connected
      ? `${state.locationName || `${state.lat}, ${state.lng}`} | ${fieldLabel}`
      : 'Connect a place';
  }
  document.querySelectorAll('[data-map-mode]').forEach(button => {
    const active = button.dataset.mapMode === layerMapMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function renderLayerMapFallback(message) {
  const fallback = document.getElementById('layerMapFallback');
  if (!fallback) return;
  const lat = state.lat != null && state.lat !== '' && Number.isFinite(Number(state.lat)) ? Number(state.lat).toFixed(4) : null;
  const lng = state.lng != null && state.lng !== '' && Number.isFinite(Number(state.lng)) ? Number(state.lng).toFixed(4) : null;
  const tileUrl = state.connected ? fallbackTileUrl() : '';
  fallback.style.display = 'grid';
  if (tileUrl) {
    fallback.style.backgroundImage = `linear-gradient(180deg, rgba(7,17,31,0.20), rgba(7,17,31,0.64)), radial-gradient(circle at 50% 50%, rgba(24,211,154,0.10), transparent 34%), url("${tileUrl}")`;
    fallback.style.backgroundSize = 'cover, cover, cover';
    fallback.style.backgroundPosition = 'center';
  } else {
    fallback.style.backgroundImage = '';
    fallback.style.backgroundSize = '';
    fallback.style.backgroundPosition = '';
  }
  fallback.innerHTML = `
    <span class="layer-map-target"></span>
    <strong>${escHtml(message || (state.connected ? state.locationName || 'Selected spot' : 'Select and connect a location'))}</strong>
    ${lat && lng ? `<small>${escHtml(lat)}, ${escHtml(lng)}</small>` : ''}
  `;
}

function hideLayerMapFallback() {
  const fallback = document.getElementById('layerMapFallback');
  if (fallback) fallback.style.display = 'none';
}

function setLayerMapMode(mode) {
  if (!['all', 'terrain', 'marine', 'risk'].includes(mode)) return;
  layerMapMode = mode;
  updateLayerMapShell();
  updateLayerMapVisibility();
  updateLayerMapCamera();
}

function renderLayerMap() {
  updateLayerMapShell();
  const container = document.getElementById('layerMap');
  if (!container) return;

  if (!state.connected || state.lat == null || state.lng == null) {
    renderLayerMapFallback();
    return;
  }

  if (layerMapFailed || !window.maplibregl) {
    renderLayerMapFallback(state.locationName || 'Selected spot');
    return;
  }

  if (!layerMap) {
    if (!layerMapBaseConfigLoaded) {
      renderLayerMapFallback('Loading free map layers...');
      loadLayerMapBaseConfig().finally(() => renderLayerMap());
      return;
    }

    try {
      const camera = layerMapCamera();
      layerMap = new maplibregl.Map({
        container,
        style: layerMapStyle(),
        center: [Number(state.lng), Number(state.lat)],
        zoom: camera.zoom,
        pitch: camera.pitch,
        bearing: camera.bearing,
        maxPitch: 65,
        attributionControl: false,
        dragRotate: true,
        pitchWithRotate: true
      });
      layerMap.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      layerMap.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
      layerMap.on('load', () => {
        layerMapReady = true;
        addLayerMapLayers();
        hideLayerMapFallback();
        setTimeout(collapseLayerMapAttribution, 250);
        setTimeout(collapseLayerMapAttribution, 1200);
        renderLayerMap();
      });
      layerMap.on('error', (event) => {
        console.warn('Senlay layer map warning:', event?.error?.message || 'map warning');
      });
    } catch (_) {
      window.__senlayLayerMapLastError = _?.message || String(_);
      console.warn('Senlay layer map failed:', window.__senlayLayerMapLastError);
      layerMapFailed = true;
      renderLayerMapFallback(state.locationName || 'Selected spot');
    }
    return;
  }

  if (!layerMapReady) return;
  hideLayerMapFallback();
  layerMap.resize();
  layerMap.jumpTo({ center: [Number(state.lng), Number(state.lat)], ...layerMapCamera() });
  const source = layerMap.getSource('senlay-overlays');
  if (source) source.setData(buildLayerMapFeatures());
  updateLayerMapVisibility();
  collapseLayerMapAttribution();
}

function legacyRiskAssessment(summary, events) {
  if (!summary && (!events || !events.length)) return null;
  const top = (events || [])[0] || null;
  const availabilityEvent = (events || []).find(event => [
    'insufficient_live_evidence',
    'partial_live_evidence',
    'evidence_policy_unknown'
  ].includes(event?.type));
  const assessmentState = availabilityEvent?.type === 'insufficient_live_evidence'
    ? 'insufficient'
    : availabilityEvent?.type === 'partial_live_evidence'
      ? 'partial'
      : availabilityEvent?.type === 'evidence_policy_unknown'
        ? 'unknown'
        : 'unknown';
  const hasOperationalEvent = (events || []).some(event => event?.category !== 'data_quality');
  const evidenceCannotClearRisk = !hasOperationalEvent;
  const severity = summary?.max_severity || top?.severity || 'none';
  const level = evidenceCannotClearRisk
    ? 'unknown'
    : severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : severity === 'moderate' || severity === 'medium' ? 'medium' : 'low';
  return {
    assessment_state: assessmentState,
    risk_score: evidenceCannotClearRisk ? null : summary?.max_score ?? top?.score ?? 0,
    risk_level: level,
    alert_band: evidenceCannotClearRisk ? {
      id: assessmentState === 'partial' ? 'evidence_incomplete' : 'evidence_unavailable',
      label: assessmentState === 'partial' ? 'Evidence incomplete' : 'Evidence unavailable'
    } : null,
    confidence: top?.confidence || (summary?.count ? 'medium' : 'low'),
    escalation_stage: evidenceCannotClearRisk ? 'evidence_check_required' : summary?.alert_required ? 'operator_review' : summary?.count ? 'watch' : 'baseline_monitoring',
    incident_state: evidenceCannotClearRisk ? `evidence_${assessmentState}` : summary?.acknowledgement_required ? 'active_ack_required' : summary?.count ? 'monitoring' : 'no_flags_from_available_evidence',
    recommended_action: evidenceCannotClearRisk
      ? 'Risk is unknown. Obtain current activity-required observations before a high-consequence decision.'
      : top?.recommended_action || 'No deterministic flags were produced from the available evidence. This is not a safety clearance; recheck live sources before operational decisions.',
    reasons: (events || []).slice(0, 4).map(event => event.summary || event.title || event.type),
    source_provenance: {
      source_count: 0,
      primary_sources: []
    }
  };
}

function renderRiskAssessmentPanel() {
  const assessment = state.riskAssessment || legacyRiskAssessment(state.riskSummary, state.riskEvents);
  if (!assessment) return '';
  const alertBand = assessment.alert_band || {};
  const color = riskLevelColor(assessment.risk_level);
  const reasons = Array.isArray(assessment.reasons) ? assessment.reasons.slice(0, 3) : [];
  const provenance = assessment.source_provenance || {};
  const sources = Array.isArray(provenance.primary_sources) && provenance.primary_sources.length
    ? provenance.primary_sources.slice(0, 3).join(' | ')
    : Array.isArray(provenance.source_chain) && provenance.source_chain.length
      ? provenance.source_chain.slice(0, 3).join(' | ')
    : 'available evidence (may be incomplete)';
  const scoreText = assessment.risk_score == null ? 'not scored' : `${assessment.risk_score}/100`;
  let html = `<div class="sensor-section hw-border">
    <div class="sensor-section-title">DETERMINISTIC RISK ENGINE <span class="badge-hw" style="color:${color}">${escHtml(String(assessment.risk_level || 'unknown').toUpperCase())}</span></div>
    <div class="sensor-row"><span class="sense-verb">Score:</span> <span class="sense-value">${escHtml(scoreText)} | ${escHtml(alertBand.label || (assessment.risk_level === 'unknown' ? 'Evidence unavailable' : 'Evidence check'))} | confidence ${escHtml(assessment.confidence || 'low')}</span></div>
    <div class="sensor-row"><span class="sense-verb">Evidence:</span> <span class="sense-value">${escHtml(assessment.assessment_state || 'unknown')}</span></div>
    <div class="sensor-row"><span class="sense-verb">State:</span> <span class="sense-value">${escHtml(assessment.incident_state || 'no_flags_from_available_evidence')} | ${escHtml(assessment.escalation_stage || 'baseline_monitoring')}</span></div>
    <div class="sensor-row"><span class="sense-verb">Action:</span> <span class="sense-value">${escHtml(assessment.recommended_action || 'Continue normal monitoring.')}</span></div>`;
  if (reasons.length) {
    html += `<div class="sensor-row"><span class="sense-verb">Why:</span> <span class="sense-value">${escHtml(reasons.join(' | '))}</span></div>`;
  }
  html += `<div class="sensor-row"><span class="sense-verb">Provenance:</span> <span class="sense-value">${escHtml(sources)}${provenance.source_count ? ` (${provenance.source_count} source refs)` : ''}</span></div>
  </div>`;
  return html;
}

function layerStatusLabel(status) {
  return String(status || 'unknown').replace(/_/g, ' ');
}

function isLayerActiveStatus(status) {
  return ['active', 'available', 'active_or_contextual', 'active_validated'].includes(String(status || ''));
}

function renderLayerStackPanel() {
  const context = state.layerContext;
  if (!context) return '';
  const layers = Array.isArray(context.active_layers) ? context.active_layers : [];
  if (!layers.length) return '';

  const activeCount = layers.filter(layer => isLayerActiveStatus(layer.status)).length;
  const missing = Array.isArray(context.missing_or_next_layers) ? context.missing_or_next_layers : [];
  const terrain = context.contexts?.terrain;
  const marine = context.contexts?.marine;
  const wind = context.contexts?.wind;
  const actions = Array.isArray(context.recommended_actions) ? context.recommended_actions.slice(0, 2) : [];
  const visibleLayers = layers.slice(0, 8);

  let html = `<div class="sensor-section hw-border">
    <div class="sensor-section-title">SENLAY LAYER STACK <span class="badge-hw">${escHtml(context.layer_stack_version || 'live')}</span></div>
    <div class="sensor-row"><span class="sense-verb">Active:</span> <span class="sense-value">${activeCount}/${layers.length} layers contributing now | next ${escHtml(missing.join(', ') || 'none')}</span></div>
    <div class="sensor-row"><span class="sense-verb">Stack:</span> <span class="sense-value">${visibleLayers.map(layer => `${layer.id}:${layerStatusLabel(layer.status)}`).map(escHtml).join(' | ')}</span></div>`;

  if (terrain || marine || wind) {
    const bits = [];
    if (terrain) {
      const terrainDepth = terrain.depth_m != null ? `depth ${cElev(terrain.depth_m)} ${uL('elev')}` : null;
      const terrainElev = terrain.elevation_or_depth_m != null && !terrainDepth ? `elev ${cElev(terrain.elevation_or_depth_m)} ${uL('elev')}` : null;
      bits.push([terrain.surface_type, terrainDepth || terrainElev, terrain.surface_confidence].filter(Boolean).join(' '));
    }
    if (marine?.wave_height_m != null) bits.push(`waves ${cWave(marine.wave_height_m)} ${uL('wave')}`);
    if (wind?.gust_factor != null) bits.push(`gust factor ${wind.gust_factor}`);
    html += `<div class="sensor-row"><span class="sense-verb">Context:</span> <span class="sense-value">${escHtml(bits.filter(Boolean).join(' | ') || 'derived from current PWM')}</span></div>`;
  }

  if (actions.length) {
    html += `<div class="sensor-row"><span class="sense-verb">Next:</span> <span class="sense-value">${escHtml(actions.join(' | '))}</span></div>`;
  }

  html += '</div>';
  return html;
}

function firstAvailable(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

function renderLlmResponseContext(payload = {}) {
  if (payload.response_mode === 'human_demo') {
    return renderHumanDemoResponseContext(payload);
  }

  const sensors = payload.sensors || state.sensors || {};
  const localPatterns = payload.local_patterns || sensors.local_patterns || {};
  const terrainPattern = localPatterns.terrain || null;
  const terrainLayer = sensors.layers?.terrain || null;
  const layerContext = payload.layer_context || state.layerContext || null;
  const assessment = payload.risk_assessment
    || state.riskAssessment
    || legacyRiskAssessment(payload.risk_summary || state.riskSummary, payload.risk_events || state.riskEvents);
  const rows = [
    {
      label: '3D basis',
      value: 'Open computational layer: terrain elevation and local pattern memory. Bathymetry, shoreline, and land-cover/building layers remain unavailable unless an explicit validated source is present.'
    }
  ];

  if (layerContext) {
    const activeLayers = Array.isArray(layerContext.active_layers)
      ? layerContext.active_layers.filter(layer => isLayerActiveStatus(layer.status)).length
      : 0;
    const missing = Array.isArray(layerContext.missing_or_next_layers) ? layerContext.missing_or_next_layers : [];
    rows.push({
      label: 'Layer stack',
      value: `${activeLayers} layers active now; next cached layers: ${missing.join(', ') || 'none'}`
    });
  }

  if (terrainPattern || terrainLayer) {
    const validatedBathymetry = hasValidatedTerrainBathymetry(terrainLayer) || hasValidatedTerrainBathymetry(terrainPattern);
    const elevation = Number(firstAvailable(terrainPattern?.elevation_or_depth_m, terrainLayer?.elevation_at_point));
    const elevationText = Number.isFinite(elevation)
      ? validatedBathymetry
        ? `depth ${cElev(Math.abs(elevation))} ${uL('elev')}`
        : `terrain elevation ${cElev(elevation)} ${uL('elev')}`
      : 'terrain elevation unavailable';
    const surface = firstAvailable(
      terrainPattern?.surface_type,
      terrainLayer?.surface_type,
      terrainSurfaceLabel(terrainLayer)
    );
    const profileCount = firstAvailable(
      terrainPattern?.profile_point_count,
      terrainLayer?.profile_point_count,
      terrainLayer?.depth_profile?.length
    );
    const profileRange = firstAvailable(terrainPattern?.profile_range_km, terrainLayer?.profile_range_km);
    const bits = [surface, elevationText];
    if (profileCount) {
      bits.push(`${profileCount} profile point${Number(profileCount) === 1 ? '' : 's'}${profileRange ? ` over ${profileRange}km` : ''}`);
    }
    rows.push({ label: 'Terrain', value: bits.join('; ') });
    if (terrainPattern?.domain_note) {
      rows.push({ label: 'Modifier use', value: terrainPattern.domain_note });
    }
  }

  const wind = localPatterns.wind;
  if (wind) {
    const windBits = [];
    if (wind.selected_source) windBits.push(`source ${wind.selected_source}`);
    if (wind.point_count) windBits.push(`${wind.point_count} samples`);
    if (wind.rhythm?.average_daytime_peak_kmh != null) {
      windBits.push(`daytime peak avg ${cWind(wind.rhythm.average_daytime_peak_kmh)} ${uL('wind')}`);
    }
    if (wind.rhythm?.typical_peak_direction) {
      windBits.push(`typical peak from ${wind.rhythm.typical_peak_direction}`);
    }
    if (windBits.length) rows.push({ label: 'Wind memory', value: windBits.join('; ') });
  }

  if (assessment) {
    const alertBand = assessment.alert_band || {};
    const scoreText = assessment.risk_score == null ? 'not scored' : `${assessment.risk_score}/100`;
    const riskBits = [
      `${alertBand.label || assessment.risk_level || 'Evidence unavailable'} ${scoreText}`,
      `evidence ${assessment.assessment_state || 'unknown'}`,
      `confidence ${assessment.confidence || 'medium'}`
    ];
    if (assessment.recommended_action) riskBits.push(assessment.recommended_action);
    rows.push({ label: 'Risk state', value: riskBits.join('; ') });
  }

  return `<div class="llm-response-context">
    <div class="llm-response-context-title">SENLAY LAYER/RISK CONTEXT INCLUDED IN THIS LLM RESPONSE</div>
    ${rows.map(row => `<div class="llm-context-row"><span>${escHtml(row.label)}:</span><strong>${escHtml(row.value)}</strong></div>`).join('')}
  </div>`;
}

function renderHumanDemoResponseContext(payload = {}) {
  const assessment = payload.risk_assessment
    || state.riskAssessment
    || legacyRiskAssessment(payload.risk_summary || state.riskSummary, payload.risk_events || state.riskEvents);
  const layerContext = payload.layer_context || state.layerContext || null;
  const activeLayers = Array.isArray(layerContext?.active_layers)
    ? layerContext.active_layers.filter(layer => isLayerActiveStatus(layer.status)).length
    : null;
  const terrain = layerContext?.contexts?.terrain || null;
  const marine = layerContext?.contexts?.marine || null;
  const wind = layerContext?.contexts?.wind || null;
  const rows = [];

  rows.push({
    label: 'Checked',
    value: `${payload.active_sources ?? state.activeSources ?? 0} live source${Number(payload.active_sources ?? state.activeSources ?? 0) === 1 ? '' : 's'}${activeLayers != null ? ` and ${activeLayers} map/context layers` : ''}`
  });

  if (assessment) {
    const band = assessment.alert_band?.label || assessment.risk_level || 'Evidence unavailable';
    rows.push({
      label: 'Risk',
      value: `${band}, ${assessment.risk_score == null ? 'not scored' : `${assessment.risk_score}/100`}, evidence ${assessment.assessment_state || 'unknown'}, confidence ${assessment.confidence || 'medium'}`
    });
  }

  const details = [];
  if (terrain?.surface_type) details.push(terrain.surface_type);
  if (terrain?.depth_m != null) details.push(`depth about ${cElev(terrain.depth_m)} ${uL('elev')}`);
  if (terrain?.elevation_or_depth_m != null && terrain.depth_m == null) details.push(`elevation about ${cElev(terrain.elevation_or_depth_m)} ${uL('elev')}`);
  if (marine?.wave_height_m != null) details.push(`waves ${cWave(marine.wave_height_m)} ${uL('wave')}`);
  if (wind?.wind_speed_kmh != null && wind?.wind_gust_kmh != null) {
    details.push(`wind ${cWind(wind.wind_speed_kmh)} ${uL('wind')}, gusts ${cWind(wind.wind_gust_kmh)} ${uL('wind')}`);
  } else if (wind?.gust_factor != null) {
    details.push('gusts are much stronger than the steady wind');
  }
  if (details.length) rows.push({ label: 'Place', value: details.join(' | ') });

  return `<div class="llm-response-context">
    <div class="llm-response-context-title">WHAT SENLAY CHECKED</div>
    ${rows.map(row => `<div class="llm-context-row"><span>${escHtml(row.label)}:</span><strong>${escHtml(row.value)}</strong></div>`).join('')}
  </div>`;
}

function finiteNum(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function localWallMs(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::(\d{2}))?/);
  if (match) {
    return Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5] || 0)
    );
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function utcToLocalWallMs(value, offsetSeconds) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed + (offsetSeconds || 0) * 1000;
}

function windMemoryHour(point) {
  const d = new Date(point.ms);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function dayStart(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function sameDay(a, b) {
  return dayStart(a) === dayStart(b);
}

function avg(values) {
  const finite = values.map(finiteNum).filter(v => v != null);
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function med(values) {
  const finite = values.map(finiteNum).filter(v => v != null).sort((a, b) => a - b);
  if (!finite.length) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
}

function round1(value) {
  const number = finiteNum(value);
  return number == null ? null : Math.round(number * 10) / 10;
}

function formatMemoryHour(hour) {
  const value = finiteNum(hour);
  if (value == null) return '--:--';
  const whole = Math.floor(value);
  const minutes = Math.round((value - whole) * 60);
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function maxBy(points, key = 'wind') {
  return points
    .filter(point => finiteNum(point?.[key]) != null)
    .reduce((best, point) => (!best || point[key] > best[key] ? point : best), null);
}

function minBy(points, key = 'wind') {
  return points
    .filter(point => finiteNum(point?.[key]) != null)
    .reduce((best, point) => (!best || point[key] < best[key] ? point : best), null);
}

function compactDirection(deg) {
  const value = finiteNum(deg);
  if (value == null) return '';
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((value % 360) + 360) % 360;
  return `${Math.round(normalized)}° ${labels[Math.round(normalized / 45) % labels.length]}`;
}

function shipDisplayName(ship) {
  if (!ship) return 'SHIP report';
  return ship.display_name
    || ship.vessel_name
    || ship.call_sign
    || ship.public_identifier
    || ship.platform_label
    || 'SHIP report';
}

function buildUiHourlyWindSeries(atmosphere) {
  const hourly = atmosphere?.hourly;
  const times = hourly?.time || [];
  const winds = hourly?.wind_speed_10m || [];
  if (!times.length || !winds.length) return null;

  const gusts = hourly.wind_gusts_10m || [];
  const directions = hourly.wind_direction_10m || [];
  const points = times.map((time, index) => {
    const ms = localWallMs(time);
    const wind = finiteNum(winds[index]);
    if (ms == null || wind == null) return null;
    return {
      ms,
      wind,
      gust: finiteNum(gusts[index]),
      direction: finiteNum(directions[index]),
      source: 'model'
    };
  }).filter(Boolean).sort((a, b) => a.ms - b.ms);
  if (!points.length) return null;

  const currentMs = localWallMs(atmosphere?.current?.time) || points[Math.max(0, Math.min(points.length - 1, points.length - 25))].ms;
  return { points, currentMs, sourceLabel: 'hourly model/history' };
}

function buildUiLoggedWindSeries(windHistory, offsetSeconds, fallbackCurrentMs) {
  const points = (windHistory?.points || []).map(point => {
    const ms = utcToLocalWallMs(point.time_utc, offsetSeconds);
    const wind = finiteNum(point.hardware_wind_kmh) ?? finiteNum(point.wind_speed_kmh) ?? finiteNum(point.model_wind_kmh);
    if (ms == null || wind == null) return null;
    return {
      ms,
      wind,
      gust: finiteNum(point.hardware_gust_kmh) ?? finiteNum(point.wind_gust_kmh) ?? finiteNum(point.model_gust_kmh),
      direction: finiteNum(point.hardware_direction_deg) ?? finiteNum(point.wind_direction_deg) ?? finiteNum(point.model_direction_deg),
      source: finiteNum(point.hardware_wind_kmh) != null ? 'hardware-history' : 'model-history'
    };
  }).filter(Boolean).sort((a, b) => a.ms - b.ms);
  if (!points.length) return null;
  const spanHours = (points[points.length - 1].ms - points[0].ms) / 3600000;
  return {
    points,
    currentMs: fallbackCurrentMs || points[points.length - 1].ms,
    sourceLabel: 'Senlay request/hardware memory',
    usable: points.length >= 24 && spanHours >= 24,
    spanHours
  };
}

function buildUiProviderWindSeries(history, offsetSeconds, fallbackCurrentMs) {
  const points = (history?.points || []).map(point => {
    const ms = utcToLocalWallMs(point.time_utc, offsetSeconds);
    const wind = finiteNum(point.wind_speed_kmh);
    if (ms == null || wind == null) return null;
    return {
      ms,
      wind,
      gust: finiteNum(point.wind_gust_kmh),
      direction: finiteNum(point.wind_direction_deg),
      source: 'provider-hardware-history'
    };
  }).filter(Boolean).sort((a, b) => a.ms - b.ms);
  if (!points.length) return null;
  const spanHours = (points[points.length - 1].ms - points[0].ms) / 3600000;
  return {
    points,
    currentMs: fallbackCurrentMs || points[points.length - 1].ms,
    sourceLabel: `${history.provider || 'hardware'} provider history`,
    usable: points.length >= 24 && spanHours >= 24,
    spanHours
  };
}

function dailyWindCycles(points, currentMs) {
  const groups = new Map();
  points.forEach(point => {
    const key = dayKey(point.ms);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
  });

  return [...groups.values()]
    .map(dayPoints => dayPoints.sort((a, b) => a.ms - b.ms))
    .filter(dayPoints => dayPoints.length >= 8)
    .map(dayPoints => {
      const early = dayPoints.filter(point => windMemoryHour(point) >= 0 && windMemoryHour(point) <= 10);
      const daytime = dayPoints.filter(point => windMemoryHour(point) >= 8 && windMemoryHour(point) <= 18);
      const low = minBy(early.length >= 2 ? early : dayPoints);
      const peak = maxBy(daytime.length >= 3 ? daytime : dayPoints);
      let onset = null;
      if (low) {
        onset = dayPoints.find(point => {
          const hour = windMemoryHour(point);
          return point.ms > low.ms && hour >= 8 && hour <= 15 && point.wind >= Math.max(8, low.wind + 4);
        }) || null;
      }
      const gusty = dayPoints.some(point => point.wind >= 8 && finiteNum(point.gust) != null && point.gust / point.wind >= 1.7);
      return { low, peak, onset, gusty, isToday: sameDay(dayPoints[0].ms, currentMs) };
    })
    .filter(cycle => cycle.low && cycle.peak);
}

function buildUiWaveSeries(hydrosphere, fallbackCurrentMs) {
  const hourly = hydrosphere?.hourly;
  const times = hourly?.time || [];
  const waves = hourly?.wave_height || [];
  if (!times.length || !waves.length) return null;

  const periods = hourly.wave_period || [];
  const directions = hourly.wave_direction || [];
  const swells = hourly.swell_wave_height || [];
  const swellPeriods = hourly.swell_wave_period || [];
  const points = times.map((time, index) => {
    const ms = localWallMs(time);
    const wave = finiteNum(waves[index]);
    if (ms == null || wave == null) return null;
    return {
      ms,
      wave,
      period: finiteNum(periods[index]),
      direction: finiteNum(directions[index]),
      swell: finiteNum(swells[index]),
      swellPeriod: finiteNum(swellPeriods[index])
    };
  }).filter(Boolean).sort((a, b) => a.ms - b.ms);
  if (!points.length) return null;

  return {
    points,
    currentMs: localWallMs(hydrosphere?.current?.time) || fallbackCurrentMs || points[Math.max(0, points.length - 25)].ms
  };
}

function dailyWaveStats(points, currentMs) {
  const groups = new Map();
  points.forEach(point => {
    const key = dayKey(point.ms);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
  });

  return [...groups.values()]
    .map(dayPoints => dayPoints.sort((a, b) => a.ms - b.ms))
    .filter(dayPoints => dayPoints.length >= 8)
    .map(dayPoints => ({
      avgWave: avg(dayPoints.map(point => point.wave)),
      peakWave: maxBy(dayPoints, 'wave'),
      avgPeriod: avg(dayPoints.map(point => point.period)),
      peakSwell: maxBy(dayPoints.filter(point => point.swell != null).map(point => ({ ...point, wave: point.swell })), 'wave'),
      isToday: sameDay(dayPoints[0].ms, currentMs)
    }))
    .filter(day => day.peakWave);
}

function renderDomainMemory(layers, ext, agreement) {
  const atmosphere = layers.atmosphere;
  const hydrosphere = layers.hydrosphere;
  const hourly = buildUiHourlyWindSeries(atmosphere);
  if (!hourly) return '';

  const provider = buildUiProviderWindSeries(ext.hardware_history, atmosphere?.utc_offset_seconds || 0, hourly.currentMs);
  const logged = buildUiLoggedWindSeries(ext.wind_history, atmosphere?.utc_offset_seconds || 0, hourly.currentMs);
  const series = provider?.usable ? provider : logged?.usable && logged.spanHours >= 168 ? logged : hourly;
  const nowMs = hourly.currentMs;
  const current = atmosphere?.current ? {
    ms: nowMs,
    wind: finiteNum(atmosphere.current.wind_speed_10m),
    gust: finiteNum(atmosphere.current.wind_gusts_10m),
    direction: finiteNum(atmosphere.current.wind_direction_10m),
    source: atmosphere.current_source?.mode === 'hardware_with_model_fallback' ? 'hardware-current' : 'model-current'
  } : null;

  const past = series.points.filter(point => point.ms <= nowMs + 30 * 60000);
  if (past.length < 12) return '';
  const analysis = current?.wind != null ? [...past, current] : past;
  const cycles = dailyWindCycles(past, nowMs);
  const usable = cycles.length ? cycles : dailyWindCycles(analysis, nowMs);
  const lows = usable.map(cycle => cycle.low.wind);
  const peaks = usable.map(cycle => cycle.peak.wind);
  const lowHour = formatMemoryHour(med(usable.map(cycle => windMemoryHour(cycle.low))));
  const peakHour = formatMemoryHour(med(usable.map(cycle => windMemoryHour(cycle.peak))));
  const rampCount = usable.filter(cycle => cycle.onset && cycle.peak.wind - cycle.low.wind >= 5).length;
  const gustyCount = usable.filter(cycle => cycle.gusty).length;
  const today = analysis.filter(point => sameDay(point.ms, nowMs));
  const todayPeak = maxBy(today.filter(point => windMemoryHour(point) >= 0 && windMemoryHour(point) <= 18));
  const strongest = maxBy(analysis);
  const spanDays = past.length > 1 ? Math.round((past[past.length - 1].ms - past[0].ms) / 8640000) / 10 : null;
  const historyCount = ext.wind_history?.snapshot_count || 0;
  const providerPoints = ext.hardware_history?.points?.length || 0;
  const sourceText = provider?.usable
    ? `${providerPoints} provider hardware points (${ext.hardware_history?.provider || 'hardware'})`
    : logged?.usable && logged.spanHours >= 168
      ? `${historyCount} Senlay snapshots`
      : `${spanDays || 7} past model days + ${historyCount} Senlay snapshot${historyCount === 1 ? '' : 's'}${providerPoints ? `; provider history ${providerPoints} point(s), not enough yet` : ''}`;
  const ridingDays = usable.filter(cycle => cycle.peak.wind >= 22).length;
  const trust = agreement?.forecast_trust || 'unknown';
  const trustText = trust === 'low'
    ? 'nearest hardware is current truth'
    : trust === 'moderate'
      ? 'model trend is comparison'
      : 'model trend usable, hardware still primary';
  const waterDomain = ['kitesurfing', 'surfing', 'sailing'].includes(state.field);

  let html = `<div class="sensor-section hw-border">
    <div class="sensor-section-title">LOCAL PATTERN MEMORY <span class="badge-model">7-DAY</span></div>
    <div class="sensor-row"><span class="sense-verb">Scope:</span> <span class="sense-value">${escHtml(sourceText)}</span></div>`;

  if (usable.length >= 2) {
    html += `<div class="sensor-row"><span class="sense-verb">Wind rhythm:</span> <span class="sense-value">low avg ${cWind(round1(avg(lows)))} ${uL('wind')} near ${escHtml(lowHour)}; peak avg ${cWind(round1(avg(peaks)))} ${uL('wind')} near ${escHtml(peakHour)}</span></div>`;
    html += `<div class="sensor-row"><span class="sense-verb">Wind ramp:</span> <span class="sense-value">${rampCount}/${usable.length} day(s) show daytime ramp${rampCount ? `, usually around ${escHtml(formatMemoryHour(med(usable.filter(c => c.onset).map(c => windMemoryHour(c.onset)))) )}` : ''}</span></div>`;
    html += `<div class="sensor-row"><span class="sense-verb">Gust memory:</span> <span class="sense-value">${gustyCount}/${usable.length} day(s) had gust factor >=1.7x during usable wind</span></div>`;
    if (state.field === 'kitesurfing') {
      html += `<div class="sensor-row"><span class="sense-verb">Kite threshold:</span> <span class="sense-value">${ridingDays}/${usable.length} day(s) reached ~22 km/h / 12 kt</span></div>`;
    }
  }

  if (current?.wind != null) {
    html += `<div class="sensor-row"><span class="sense-verb">Now:</span> <span class="sense-value">${cWind(current.wind)} ${uL('wind')}${current.direction != null ? ` from ${escHtml(compactDirection(current.direction))}` : ''}${current.gust != null ? `, gusts ${cWind(current.gust)} ${uL('wind')}` : ''}</span></div>`;
  }
  if (todayPeak) {
    html += `<div class="sensor-row"><span class="sense-verb">Today peak:</span> <span class="sense-value">${cWind(todayPeak.wind)} ${uL('wind')}${todayPeak.direction != null ? ` from ${escHtml(compactDirection(todayPeak.direction))}` : ''}</span></div>`;
  }
  if (strongest && todayPeak && strongest.wind > todayPeak.wind + 2) {
    html += `<div class="sensor-row"><span class="sense-verb">Memory:</span> <span class="sense-value">7-day max ${cWind(strongest.wind)} ${uL('wind')}; do not extrapolate it into now</span></div>`;
  }

  if (waterDomain) {
    const waveSeries = buildUiWaveSeries(hydrosphere, nowMs);
    const wavePast = waveSeries?.points?.filter(point => point.ms <= waveSeries.currentMs + 30 * 60000) || [];
    const waveDays = dailyWaveStats(wavePast, waveSeries?.currentMs || nowMs);
    const waveCurrent = hydrosphere?.current || {};
    if (waveDays.length >= 2) {
      const avgWaveHeight = round1(avg(waveDays.map(day => day.avgWave)));
      const avgWavePeak = round1(avg(waveDays.map(day => day.peakWave.wave)));
      const avgWavePeriod = round1(avg(waveDays.map(day => day.avgPeriod)));
      const todayWavePeak = maxBy(wavePast.filter(point => sameDay(point.ms, waveSeries.currentMs)), 'wave');
      html += `<div class="sensor-row"><span class="sense-verb">Wave memory:</span> <span class="sense-value">avg ${cWave(avgWaveHeight)} ${uL('wave')}; daily peak avg ${cWave(avgWavePeak)} ${uL('wave')}${avgWavePeriod != null ? `, period ~${avgWavePeriod}s` : ''}</span></div>`;
      if (todayWavePeak) {
        html += `<div class="sensor-row"><span class="sense-verb">Today waves:</span> <span class="sense-value">peak ${cWave(todayWavePeak.wave)} ${uL('wave')}${todayWavePeak.period != null ? ` / ${todayWavePeak.period}s` : ''}${todayWavePeak.direction != null ? ` from ${escHtml(compactDirection(todayWavePeak.direction))}` : ''}</span></div>`;
      }
    } else if (waveCurrent.wave_height != null) {
      html += `<div class="sensor-row"><span class="sense-verb">Waves now:</span> <span class="sense-value">${cWave(waveCurrent.wave_height)} ${uL('wave')}${waveCurrent.wave_period != null ? ` / ${waveCurrent.wave_period}s` : ''}${waveCurrent.wave_direction != null ? ` from ${escHtml(compactDirection(waveCurrent.wave_direction))}` : ''}</span></div>`;
    }

    if (waveCurrent.swell_wave_height != null) {
      html += `<div class="sensor-row"><span class="sense-verb">Swell now:</span> <span class="sense-value">${cWave(waveCurrent.swell_wave_height)} ${uL('wave')}${waveCurrent.swell_wave_period != null ? ` / ${waveCurrent.swell_wave_period}s` : ''}${waveCurrent.swell_wave_direction != null ? ` from ${escHtml(compactDirection(waveCurrent.swell_wave_direction))}` : ''}</span></div>`;
    }

    const ships = localSources(ext.ship_observations, 'ship');
    if (ships.length > 0) {
      const nearestShip = ships[0];
      const shipBits = [];
      if (nearestShip.wind_speed_kmh != null) {
        shipBits.push(`wind ${cWind(nearestShip.wind_speed_kmh)} ${uL('wind')}${nearestShip.wind_direction != null ? ` from ${compactDirection(nearestShip.wind_direction)}` : ''}`);
      }
      if (nearestShip.wave_height_m != null) shipBits.push(`waves ${cWave(nearestShip.wave_height_m)} ${uL('wave')}`);
      if (nearestShip.pressure_hpa != null) shipBits.push(`pressure ${cPress(nearestShip.pressure_hpa)} ${uL('press')}`);
      const ageText = nearestShip.age_minutes != null ? `, ${nearestShip.age_minutes} min old` : '';
      const identityNote = nearestShip.identity_status === 'anonymized_by_noaa_ndbc' ? 'source anonymized' : 'source identity';
      html += `<div class="sensor-row"><span class="sense-verb">Ship/offshore:</span> <span class="sense-value">${escHtml(shipDisplayName(nearestShip))} ${nearestShip.distance_km}km away${escHtml(ageText)}; ${escHtml(shipBits.join(', ') || 'marine report available')} — ${escHtml(identityNote)}, comparison only</span></div>`;
    } else if ((ext.ship_observations || []).length > 0) {
      html += `<div class="sensor-row"><span class="sense-verb">Ship/offshore:</span> <span class="sense-value">no local ship report within ${LOCAL_SOURCE_LIMITS_KM.ship}km; farther reports hidden</span></div>`;
    }

    const tides = ext.tides;
    if (tides) {
      const tideBits = [];
      if (tides.current_level_m != null) tideBits.push(`level ${cElev(tides.current_level_m)} ${uL('elev')}`);
      if (tides.next_high) tideBits.push(`next high ${tides.next_high.time}`);
      if (tides.next_low) tideBits.push(`next low ${tides.next_low.time}`);
      html += `<div class="sensor-row"><span class="sense-verb">Tide/current:</span> <span class="sense-value">${escHtml(tideBits.join(' | ') || 'tide gauge available')}</span></div>`;
    } else if (ext.world_tides?.status === 'active_with_key') {
      const wt = ext.world_tides;
      const tideBits = [];
      if (wt.current_height_m != null) tideBits.push(`predicted height ${cElev(wt.current_height_m)} ${uL('elev')}`);
      if (wt.next_high) tideBits.push(`next high ${wt.next_high.time}`);
      if (wt.next_low) tideBits.push(`next low ${wt.next_low.time}`);
      html += `<div class="sensor-row"><span class="sense-verb">Tide/current:</span> <span class="sense-value">${escHtml(tideBits.join(' | ') || 'WorldTides prediction')} — prediction fallback</span></div>`;
    } else {
      html += `<div class="sensor-row"><span class="sense-verb">Tide/current:</span> <span class="sense-value">no live tide/current sensor in the default layer; use wave/wind context and preserve the data gap</span></div>`;
    }

    const currents = ext.currents;
    if (currents?.realtime_station?.current) {
      const station = currents.realtime_station;
      const current = station.current;
      html += `<div class="sensor-row"><span class="sense-verb">Current meter:</span> <span class="sense-value">${escHtml(station.name)} ${station.distance_km}km; ${cWind(current.speed_kmh)} ${uL('wind')} from ${escHtml(compactDirection(current.direction_deg))}</span></div>`;
    } else if (currents?.prediction_station?.current) {
      const station = currents.prediction_station;
      const current = station.current;
      html += `<div class="sensor-row"><span class="sense-verb">Current prediction:</span> <span class="sense-value">${escHtml(station.name)} ${station.distance_km}km; ${cWind(current.speed_kmh)} ${uL('wind')} from ${escHtml(compactDirection(current.direction_deg))}</span></div>`;
    }

    const stormglass = sourceHasErrorStatus(ext.stormglass_marine) ? null : ext.stormglass_marine;
    if (stormglass?.status === 'active_with_key') {
      const bits = [];
      if (stormglass.wave_height_m != null) bits.push(`wave ${cWave(stormglass.wave_height_m)} ${uL('wave')}`);
      if (stormglass.current_speed_mps != null) bits.push(`current ${stormglass.current_speed_mps} m/s`);
      if (stormglass.water_temp_c != null) bits.push(`water ${cTemp(stormglass.water_temp_c)}${uL('temp')}`);
      html += `<div class="sensor-row"><span class="sense-verb">Stormglass:</span> <span class="sense-value">${escHtml(bits.join(' | ') || 'marine cross-check active')}</span></div>`;
    }

    const usgs = localSources(ext.usgs_water, 'water');
    if (usgs.length > 0) {
      const station = usgs[0];
      const variables = Object.values(station.variables || {}).slice(0, 2).map(v => `${v.label}: ${v.value} ${v.unit || ''}`).join(' | ');
      html += `<div class="sensor-row"><span class="sense-verb">River/inlet:</span> <span class="sense-value">${escHtml(station.name || station.station_id)} ${station.distance_km}km${variables ? `; ${escHtml(variables)}` : ''}</span></div>`;
    }

    const webcams = localSources(ext.windy_webcams, 'webcam');
    if (webcams.length > 0) {
      const cam = webcams[0];
      html += `<div class="sensor-row"><span class="sense-verb">Visual check:</span> <span class="sense-value">${escHtml(cam.title || cam.webcam_id)} ${cam.distance_km}km${cam.status ? `, ${escHtml(cam.status)}` : ''}; webcam confirms launch context, not a numeric forecast</span></div>`;
    }

    const openSense = localSources(ext.opensensemap, 'community');
    if (openSense.length > 0) {
      const box = openSense[0];
      const sensors = (box.sensors || []).slice(0, 2).map(s => `${s.title}: ${s.value ?? 'n/a'} ${s.unit || ''}`).join(' | ');
      html += `<div class="sensor-row"><span class="sense-verb">Microclimate:</span> <span class="sense-value">${escHtml(box.name || box.station_id)} ${box.distance_km}km${box.is_stale ? ' [stale]' : ''}${sensors ? `; ${escHtml(sensors)}` : ''}</span></div>`;
    }

    const terrain = layers.terrain;
    if (terrain && !terrain.error) {
      const terrainText = hasValidatedTerrainBathymetry(terrain) && terrain.is_ocean === true
        ? `validated water depth ${cElev(Math.abs(terrain.elevation_at_point))} ${uL('elev')}`
        : `terrain elevation ${cElev(terrain.elevation_at_point)} ${uL('elev')}; surface class ${terrainSurfaceLabel(terrain)}`;
      html += `<div class="sensor-row"><span class="sense-verb">Spot context:</span> <span class="sense-value">${escHtml(terrainText)}; check wind shadow and rescue margin. Shallow bars or reefs require validated bathymetry or curated spot data.</span></div>`;
    }
  }

  html += `<div class="sensor-row"><span class="sense-verb">Trust:</span> <span class="sense-value">${escHtml(trustText)}</span></div>
  </div>`;
  return html;
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

function clearSearchResults() {
  state.searchResults = [];
  const resultsEl = document.getElementById('searchResults');
  if (resultsEl) {
    resultsEl.classList.add('hidden');
    resultsEl.innerHTML = '';
  }
}

function searchResultTitle(place) {
  const address = place?.address || {};
  return address.city
    || address.town
    || address.village
    || address.municipality
    || address.county
    || place?.name
    || String(place?.display_name || '').split(',')[0]
    || 'Selected place';
}

function searchResultSubtitle(place) {
  const parts = String(place?.display_name || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  return parts.slice(1, 5).join(', ') || `${Number(place?.lat).toFixed(4)}, ${Number(place?.lon).toFixed(4)}`;
}

function renderSearchResults(results, message = '') {
  const resultsEl = document.getElementById('searchResults');
  if (!resultsEl) return;
  resultsEl.innerHTML = '';
  if (!results.length) {
    resultsEl.classList.toggle('hidden', !message);
    if (message) resultsEl.innerHTML = `<div class="search-results-empty">${escHtml(message)}</div>`;
    return;
  }

  resultsEl.classList.remove('hidden');
  results.forEach((place, index) => {
    const lat = Number(place.lat);
    const lng = Number(place.lon);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result-btn';
    button.innerHTML = `
      <strong>${escHtml(searchResultTitle(place))}</strong>
      <span>${escHtml(searchResultSubtitle(place))}</span>
      <span>${Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : ''}</span>
    `;
    button.addEventListener('click', () => selectSearchResult(index));
    resultsEl.appendChild(button);
  });
}

function selectSearchResult(index) {
  const place = state.searchResults[index];
  if (!place) return;
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const title = searchResultTitle(place);
  applyLocation(+lat.toFixed(4), +lng.toFixed(4), title);
  const input = document.getElementById('citySearch');
  if (input) input.value = title;
  focusDemoStep('connect');
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
    state.riskAssessment = null;
    state.riskSummary = null;
    state.riskEvents = [];
    state.layerContext = null;
    state.layerCatalog = null;
    state.pwmFetchedAt = null;
    document.getElementById('mainArea')?.classList.add('hidden');
    document.getElementById('statusBar')?.classList.add('hidden');
    document.getElementById('setupPanel')?.classList.remove('collapsed');
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
      setConnectionStatus(statusEl, 'disconnected', 'Location changed. Connect again for fresh data.');
    }
    document.getElementById('connDetails')?.classList.add('hidden');
  }
  const display = document.getElementById('locationDisplay');
  if (display) {
    display.textContent = `${name} (${lat}, ${lng})`;
  }
  clearSearchResults();
  const manualLat = document.getElementById('manualLat');
  const manualLng = document.getElementById('manualLng');
  if (manualLat) manualLat.value = lat;
  if (manualLng) manualLng.value = lng;
  const spotSelect = document.getElementById('spotSelect');
  if (spotSelect) spotSelect.value = '';
  savePrefs();
  updateLayerMapShell();
  if (!state.connected) renderLayerMapFallback();
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
    state.profileSessionToken = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || '';
    if (state.profileSessionToken) sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, state.profileSessionToken);
    localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    const locRaw = localStorage.getItem(LOCATION_STORAGE_KEY);

    if (provider) {
      state.provider = provider;
      const sel = document.getElementById('providerSelect');
      if (sel) {
        sel.value = provider;
        if (sel.value !== provider) {
          state.provider = 'demo';
          sel.value = 'demo';
        }
      }
      updateProviderRows();
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

function hasUsableProvider() {
  if (state.provider === 'demo') return true;
  if (state.provider === 'profile') return !!state.profileDefaultKey;
  return !!state.apiKey;
}

function currentGuideStep() {
  const hasProvider = hasUsableProvider();
  const hasLocation = state.lat !== null && state.lng !== null;
  const hasQuestion = state.messages.some(m => m.role === 'user');
  if (!hasProvider) return 1;
  if (!hasLocation && !hasQuestion && !state.connected) return 1;
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
    1: 'Choose the activity first.',
    2: 'Search any place, choose a result, use your location, or pin exact coordinates.',
    3: 'Connect to load the live data behind the answer.',
    4: 'Ask a question or use a prompt chip below the chat.',
    5: 'Demo complete. Change the place, use case, or units to compare another scenario.'
  };
  status.textContent = messages[current] || messages[5];
  const action = document.getElementById('guideAction');
  if (action) {
    const actions = {
      1: 'Choose Use Case',
      2: 'Pin Place',
      3: 'Connect Now',
      4: 'Try a Question',
      5: 'Run Another Place'
    };
    action.textContent = actions[current] || actions[5];
  }
}

function promptSetForField(field) {
  if (field === 'surfing') return QUICK_PROMPTS.kitesurfing;
  return QUICK_PROMPTS[field] || QUICK_PROMPTS.general;
}

function updatePromptChips() {
  const chips = document.getElementById('promptChips');
  if (!chips) return;
  chips.innerHTML = '';
  promptSetForField(state.field).forEach(([label, prompt]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => usePrompt(prompt));
    chips.appendChild(btn);
  });
}

function setDemoMode() {
  const select = document.getElementById('providerSelect');
  if (select) {
    select.value = 'demo';
    onProviderChange();
  }
  focusDemoStep('usecase');
}

function advanceDemoGuide() {
  const current = currentGuideStep();
  if (current === 1) {
    focusDemoStep('usecase');
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
    usePrompt(promptSetForField(state.field)[0][1]);
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
    mode: 'settingsCard',
    usecase: 'fieldCard',
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
  loadProfileKeyState();
  loadSpots();
  loadTicker();
  updatePromptChips();
  updateDemoGuide();
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

function providerDisplayName() {
  if (state.provider === 'profile') {
    const key = state.profileDefaultKey;
    if (!key) return 'Saved Profile Key';
    return key.label || key.providerLabel || key.provider || 'Saved Profile Key';
  }
  if (state.provider === 'demo') return 'Senlay Demo';
  if (state.provider === 'openrouter') return 'OpenRouter';
  if (state.provider === 'openai') return 'GPT-4o';
  if (state.provider === 'anthropic') return 'Claude';
  return 'Senlay Demo';
}

function publicConnectionLabel() {
  return 'Physical World Model';
}

function updateProviderRows() {
  const apiRow = document.getElementById('apiKeyRow');
  const profileRow = document.getElementById('profileKeyRow');
  const apiInput = document.getElementById('userApiKey');
  if (apiRow) apiRow.classList.toggle('hidden', state.provider === 'demo' || state.provider === 'profile');
  if (profileRow) profileRow.classList.toggle('hidden', state.provider !== 'profile');
  if (apiInput && state.apiKey && state.provider !== 'demo' && state.provider !== 'profile') {
    apiInput.value = state.apiKey;
  }
  updateProfileKeyUi();
}

function updateProfileKeyUi() {
  const hint = document.getElementById('profileKeyHint');
  const option = document.querySelector('#providerSelect option[value="profile"]');
  const key = state.profileDefaultKey;
  if (option) {
    option.textContent = key
      ? `Saved profile key: ${key.label || key.providerLabel || key.provider}`
      : 'Saved profile key (paid BYOK)';
  }
  if (!hint) return;
  if (key) {
    hint.textContent = `${key.label || key.providerLabel} is ready. ${key.providerLabel || key.provider}${key.model ? ' · ' + key.model : ''}.`;
  } else if (state.profileSessionToken && state.profileLoaded) {
    hint.textContent = 'No default model key found. Open Dashboard > AI Model Keys and save one for this paid account.';
  } else {
    hint.textContent = 'Sign in on the dashboard and save a default model key to use Senlay directly with your own LLM.';
  }
}

async function loadProfileKeyState() {
  state.profileSessionToken = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || '';
  if (state.profileSessionToken) sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, state.profileSessionToken);
  localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  if (!state.profileSessionToken) {
    state.profileLoaded = true;
    updateProfileKeyUi();
    updateDemoGuide();
    return;
  }
  try {
    const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${state.profileSessionToken}` } });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Profile unavailable');
    state.profileLlmKeys = data.llmKeys || [];
    state.profileDefaultKey = state.profileLlmKeys.find(k => k.isDefault) || state.profileLlmKeys[0] || null;
  } catch (_) {
    state.profileLlmKeys = [];
    state.profileDefaultKey = null;
    state.profileSessionToken = '';
    try { sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY); localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY); } catch (_) {}
  }
  state.profileLoaded = true;
  updateProfileKeyUi();
  updateDemoGuide();
}

// ─── Setup: Provider ────────────────────────────────────────────────
function onProviderChange() {
  const val = document.getElementById('providerSelect').value;
  state.provider = val;
  updateProviderRows();
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
  updatePromptChips();
  updateLayerMapShell();
  // Reset conversation when field changes — new persona, fresh context
  if (state.connected) {
    document.getElementById('chatMessages').innerHTML = '';
    state.messages = [];
    addSystemMessage(`Field changed to ${FIELD_LABELS[state.field] || state.field}. Ask me anything — I'm now tuned to this use case.`);
    renderLayerMap();
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
  renderSearchResults([], 'Searching global places...');
  const display = document.getElementById('locationDisplay');
  if (display) display.textContent = 'Searching...';
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1&dedupe=1`);
    const data = await res.json();
    if (!data || data.length === 0) {
      if (display) display.textContent = 'Place not found. Try another name.';
      renderSearchResults([], 'No places found. Try a city, beach, airport, mountain, or exact address.');
      input.disabled = false;
      return;
    }
    state.searchResults = data.filter(place => place?.lat != null && place?.lon != null
      && place.lat !== '' && place.lon !== ''
      && Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon)));
    renderSearchResults(state.searchResults);
    if (display) display.textContent = `Choose one of ${state.searchResults.length} search result${state.searchResults.length === 1 ? '' : 's'} to connect nearby sensors.`;
  } catch (e) {
    if (display) display.textContent = 'Search failed: ' + e.message;
    renderSearchResults([], 'Search failed. You can still enter coordinates manually.');
  }
  input.disabled = false;
}

// ─── Connect ────────────────────────────────────────────────────────
async function connectToPWM() {
  if (state.lat === null || state.lng === null) { alert('Select a location first'); return; }

  if (state.provider === 'profile') {
    if (!state.profileDefaultKey) {
      alert('No saved profile model key found. Sign in on the dashboard and save a default LLM key first.');
      return;
    }
  } else if (state.provider !== 'demo') {
    state.apiKey = document.getElementById('userApiKey').value.trim();
    if (!state.apiKey) { alert('Enter your API key'); return; }
  }
  savePrefs();

  const statusEl = document.getElementById('connectionStatus');
  const btn = document.getElementById('connectBtn');
  const connectionLabel = publicConnectionLabel();

  setConnectionStatus(statusEl, 'connecting', 'Connecting to Physical World Model...');
  btn.disabled = true;
  btn.textContent = 'Connecting...';

  try {
    const res = await fetch(`/api/pwm?lat=${state.lat}&lng=${state.lng}&field=${encodeURIComponent(state.field)}&view=full`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    state.sensors = data.sensors;
    state.satellite = data.satellite;
    state.extended = data.extended || null;
    state.riskAssessment = data.risk_assessment || null;
    state.riskSummary = data.risk_summary || null;
    state.riskEvents = data.risk_events || [];
    state.layerContext = data.layer_context || null;
    state.layerCatalog = data.layer_catalog || null;
    state.activeSources = data.active_sources ?? 0;
    state.health = data.health || [];
    state.connected = true;
    state.pwmFetchedAt = Date.now();

    setConnectionStatus(statusEl, 'connected', 'Connected to physical context');

    const details = document.getElementById('connDetails');
    details.classList.remove('hidden');
    details.textContent = `Location: ${state.locationName} | ${state.activeSources} source layers reporting data`;

    document.getElementById('mainArea').classList.remove('hidden');
    document.getElementById('setupPanel').classList.add('collapsed');
    document.getElementById('statusBar').classList.remove('hidden');
    document.getElementById('statusBarText').textContent =
      `${connectionLabel} connected — ${state.locationName} — ${state.activeSources} source layers reporting data`;

    document.getElementById('chatProviderLabel').textContent = connectionLabel;

    requestAnimationFrame(renderLayerMap);
    renderSensorFeed();

    document.getElementById('chatMessages').innerHTML = '';
    state.messages = [];
    const fieldLabel = FIELD_LABELS[state.field] || state.field;
    addSystemMessage(`Senlay connected at ${state.locationName}. ${state.activeSources} source layers are reporting data. Mode: ${fieldLabel}. Missing feeds remain unknown. What would you like to know?`);
    updateDemoGuide();

  } catch (e) {
    setConnectionStatus(statusEl, 'disconnected', 'Connection failed: ' + e.message);
    updateDemoGuide();
  }

  btn.disabled = false;
  btn.textContent = 'Connect to Physical World';
}

function toggleSetup() {
  const panel = document.getElementById('setupPanel');
  const control = document.getElementById('statusBar');
  const collapsed = panel.classList.toggle('collapsed');
  control?.setAttribute('aria-expanded', String(!collapsed));
}

// ─── Staleness helper ────────────────────────────────────────────────
function stalenessLabel() {
  if (!state.pwmFetchedAt) return '';
  const mins = Math.round((Date.now() - state.pwmFetchedAt) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function renderDecisionCards(layers, ext, agreement) {
  const assessment = state.riskAssessment || legacyRiskAssessment(state.riskSummary, state.riskEvents);
  const activeLayers = Array.isArray(state.layerContext?.active_layers)
    ? state.layerContext.active_layers.filter(layer => isLayerActiveStatus(layer.status)).length
    : null;
  const cards = [];

  if (assessment) {
    const band = assessment.alert_band?.label || assessment.risk_level || 'Evidence unavailable';
    cards.push({
      title: 'Risk',
      meta: String(band).toUpperCase(),
      value: assessment.recommended_action || `${assessment.risk_score == null ? 'not scored' : `${assessment.risk_score}/100`}, evidence ${assessment.assessment_state || 'unknown'}, confidence ${assessment.confidence || 'medium'}`
    });
  }

  const trust = agreement?.forecast_trust || layers.atmosphere?.current_source?.mode || 'live context';
  cards.push({
    title: 'Trust',
    meta: agreement?.score != null ? `${agreement.score}/100` : 'source check',
    value: String(trust).replace(/_/g, ' ')
  });

  const atm = layers.atmosphere?.current;
  if (atm) {
    const wind = `${cWind(atm.wind_speed_10m)} ${uL('wind')}`;
    const gust = atm.wind_gusts_10m != null ? `gusts ${cWind(atm.wind_gusts_10m)} ${uL('wind')}` : null;
    const temp = atm.temperature_2m != null ? `${cTemp(atm.temperature_2m)}${uL('temp')}` : null;
    cards.push({
      title: 'Atmosphere',
      meta: 'now',
      value: [wind, gust, temp].filter(Boolean).join(' | ')
    });
  }

  const terrain = layers.terrain;
  if (terrain && !terrain.error) {
    const validatedDepth = hasValidatedTerrainBathymetry(terrain) && terrain.is_ocean === true;
    cards.push({
      title: 'Terrain',
      meta: terrainSurfaceLabel(terrain),
      value: validatedDepth
        ? `depth ${cElev(Math.abs(terrain.elevation_at_point))} ${uL('elev')}`
        : `terrain elevation ${cElev(terrain.elevation_at_point)} ${uL('elev')}`
    });
  }

  const hyd = layers.hydrosphere?.current;
  if (hyd && (hyd.wave_height != null || hyd.sea_level_height_msl != null || hyd.ocean_current_velocity != null)) {
    const bits = [];
    if (hyd.wave_height != null) bits.push(`waves ${cWave(hyd.wave_height)} ${uL('wave')}`);
    if (hyd.ocean_current_velocity != null) bits.push(`current ${cWind(hyd.ocean_current_velocity)} ${uL('wind')}`);
    if (hyd.sea_level_height_msl != null) bits.push(`level ${cElev(hyd.sea_level_height_msl)} ${uL('elev')}`);
    cards.push({ title: 'Hydro', meta: 'marine', value: bits.join(' | ') });
  }

  const observedWind = localSources(ext.wind_sensors, 'wind')[0];
  if (observedWind) {
    const windBits = [];
    if (observedWind.wind_speed_kmh != null) windBits.push(`${cWind(observedWind.wind_speed_kmh)} ${uL('wind')}`);
    if (observedWind.wind_direction != null) windBits.push(`from ${compactDirection(observedWind.wind_direction)}`);
    if (observedWind.wind_gust_kmh != null) windBits.push(`gusts ${cWind(observedWind.wind_gust_kmh)} ${uL('wind')}`);
    const age = firstAvailable(observedWind.age_minutes, observedWind.observation_age_minutes);
    cards.push({
      title: 'Wind sensor',
      meta: String(observedWind.source || 'hardware').replace(/_/g, ' '),
      value: `${observedWind.name || observedWind.station_id || 'Nearby station'}${observedWind.distance_km != null ? ` • ${observedWind.distance_km} km away` : ''}${age != null ? ` • ${age} min old` : ''}${windBits.length ? ` | ${windBits.join(' ')}` : ' | reading metadata available'}`
    });
  }

  const buoy = localSources(ext.buoys, 'buoy')[0];
  if (buoy) {
    const buoyBits = [];
    if (buoy.wave_height_m != null) buoyBits.push(`waves ${cWave(buoy.wave_height_m)} ${uL('wave')}`);
    if (buoy.wave_period_s != null) buoyBits.push(`${buoy.wave_period_s}s period`);
    if (buoy.water_temp_c != null) buoyBits.push(`water ${cTemp(buoy.water_temp_c)}${uL('temp')}`);
    cards.push({
      title: 'Marine sensor',
      meta: `buoy ${buoy.station_id || ''}`.trim(),
      value: `${buoy.name || 'Nearby buoy'}${buoy.distance_km != null ? ` • ${buoy.distance_km} km away` : ''}${buoyBits.length ? ` | ${buoyBits.join(' • ')}` : ' | station available'}`
    });
  }

  const aq = layers.air_quality?.current;
  if (aq) {
    const aqBits = [];
    if (aq.european_aqi != null) aqBits.push(`AQI ${aq.european_aqi}`);
    if (aq.pm2_5 != null) aqBits.push(`PM2.5 ${aq.pm2_5} µg/m³`);
    if (aq.uv_index != null) aqBits.push(`UV ${aq.uv_index}`);
    if (aqBits.length) cards.push({ title: 'Air sensor', meta: 'current', value: aqBits.join(' • ') });
  }

  cards.push({
    title: 'Sources',
    meta: activeLayers != null ? `${activeLayers} layers` : 'live',
    value: `${state.activeSources ?? 0} live source${Number(state.activeSources ?? 0) === 1 ? '' : 's'} • open details for station names, distance, freshness, and readings`
  });

  return `<div class="decision-card-grid">
    ${cards.map(card => `<article class="decision-card">
      <span>${escHtml(card.title)}</span>
      <strong>${escHtml(card.meta)}</strong>
      <p>${escHtml(card.value)}</p>
    </article>`).join('')}
  </div>`;
}

// ─── Sensor Feed ────────────────────────────────────────────────────
function renderSensorFeed() {
  const feed = document.getElementById('sensorFeed');
  if (!state.sensors) { feed.innerHTML = '<p class="sensor-placeholder">No data</p>'; return; }

  const { layers } = state.sensors;
  const ext = state.extended || {};
  const agreement = state.sensors.forecast_agreement || ext.forecast_agreement;
  let html = renderRiskAssessmentPanel();
  html += renderLayerStackPanel();

  // Atmosphere
  const atm = layers.atmosphere?.current;
  const atmSource = layers.atmosphere?.current_source;
  if (atm) {
    const atmosphereObservations = sourceObservationSummaries(atmSource);
    const windText = atm.wind_speed_10m != null
      ? `${cWind(atm.wind_speed_10m)} ${uL('wind')}${atm.wind_direction_10m != null ? ` from ${atm.wind_direction_10m}°` : ', direction unavailable'}${atm.wind_gusts_10m != null ? ` (gusts ${cWind(atm.wind_gusts_10m)} ${uL('wind')})` : ' (gust unavailable)'}`
      : 'unavailable';
    const temperatureText = atm.temperature_2m != null
      ? `${cTemp(atm.temperature_2m)}${uL('temp')}${atm.apparent_temperature != null ? ` (feels ${cTemp(atm.apparent_temperature)}${uL('temp')})` : ''}`
      : 'unavailable';
    const atmosphericDetails = [];
    if (atm.relative_humidity_2m != null) atmosphericDetails.push(`Humidity ${atm.relative_humidity_2m}%`);
    if (atm.cloud_cover != null) atmosphericDetails.push(`Clouds ${atm.cloud_cover}%`);
    html += `<div class="sensor-section">
      <div class="sensor-section-title">ATMOSPHERE ${sourceBadge(atmSource, 'MODEL', atm)}</div>
      <div class="sensor-row"><span class="sense-verb">Wind:</span> <span class="sense-value">${windText}</span></div>
      <div class="sensor-row"><span class="sense-verb">Temperature:</span> <span class="sense-value">${temperatureText}</span></div>
      ${atm.pressure_msl != null ? `<div class="sensor-row"><span class="sense-verb">Reading:</span> <span class="sense-value">Pressure ${cPress(atm.pressure_msl)} ${uL('press')}</span></div>` : ''}
      ${atmosphericDetails.length ? `<div class="sensor-row"><span class="sense-verb">Detecting:</span> <span class="sense-value">${atmosphericDetails.join(' | ')}</span></div>` : ''}
      <div class="sensor-row"><span class="sense-verb">Source:</span> <span class="sense-value">${escHtml(sourceSummary(atmSource, atm))}</span></div>
      ${atmosphereObservations.map(item => `<div class="sensor-row"><span class="sense-verb">Observed:</span> <span class="sense-value">${escHtml(item)}</span></div>`).join('')}
    </div>`;
  }

  html += renderForecastAgreement(agreement);
  html += renderDomainMemory(layers, ext, agreement);

  // Hydrosphere
  const hyd = layers.hydrosphere?.current;
  const hydSource = layers.hydrosphere?.current_source;
  if (hyd && hyd.wave_height != null) {
    const hydrosphereObservations = sourceObservationSummaries(hydSource);
    html += `<div class="sensor-section">
      <div class="sensor-section-title">HYDROSPHERE ${sourceBadge(hydSource, 'MODEL', hyd)}</div>
      <div class="sensor-row"><span class="sense-verb">Waves:</span> <span class="sense-value">${cWave(hyd.wave_height)} ${uL('wave')}${hyd.wave_period != null ? ` (${hyd.wave_period}s period)` : ' (period unavailable)'}</span></div>`;
    if (hyd.swell_wave_height != null) {
      html += `<div class="sensor-row"><span class="sense-verb">Swell:</span> <span class="sense-value">${cWave(hyd.swell_wave_height)} ${uL('wave')} from ${hyd.swell_wave_direction}°</span></div>`;
    }
    if (hyd.wind_wave_height != null) {
      html += `<div class="sensor-row"><span class="sense-verb">Wind wave:</span> <span class="sense-value">${cWave(hyd.wind_wave_height)} ${uL('wave')}${hyd.wind_wave_period != null ? ` / ${hyd.wind_wave_period}s` : ''}${hyd.wind_wave_direction != null ? ` from ${hyd.wind_wave_direction}°` : ''}</span></div>`;
    }
    if (hyd.secondary_swell_wave_height != null) {
      html += `<div class="sensor-row"><span class="sense-verb">2nd swell:</span> <span class="sense-value">${cWave(hyd.secondary_swell_wave_height)} ${uL('wave')}${hyd.secondary_swell_wave_period != null ? ` / ${hyd.secondary_swell_wave_period}s` : ''}${hyd.secondary_swell_wave_direction != null ? ` from ${hyd.secondary_swell_wave_direction}°` : ''}</span></div>`;
    }
    if (hyd.ocean_current_velocity != null) {
      html += `<div class="sensor-row"><span class="sense-verb">Current:</span> <span class="sense-value">${cWind(hyd.ocean_current_velocity)} ${uL('wind')}${hyd.ocean_current_direction != null ? ` from ${hyd.ocean_current_direction}°` : ''} <span style="color:var(--text2)">(model)</span></span></div>`;
    }
    if (hyd.sea_level_height_msl != null) {
      html += `<div class="sensor-row"><span class="sense-verb">Sea level:</span> <span class="sense-value">${cElev(hyd.sea_level_height_msl)} ${uL('elev')} MSL <span style="color:var(--text2)">(tide model)</span></span></div>`;
    }
    if (hyd.sea_surface_temperature != null) {
      html += `<div class="sensor-row"><span class="sense-verb">SST:</span> <span class="sense-value">${cTemp(hyd.sea_surface_temperature)}${uL('temp')}</span></div>`;
    }
    if (hyd.water_temperature_c != null) {
      html += `<div class="sensor-row"><span class="sense-verb">Water:</span> <span class="sense-value">${cTemp(hyd.water_temperature_c)}${uL('temp')}</span></div>`;
    }
    html += `<div class="sensor-row"><span class="sense-verb">Source:</span> <span class="sense-value">${escHtml(sourceSummary(hydSource, hyd))}</span></div>`;
    html += hydrosphereObservations.map(item => `<div class="sensor-row"><span class="sense-verb">Observed:</span> <span class="sense-value">${escHtml(item)}</span></div>`).join('');
    html += `</div>`;
  }

  // Terrain
  const ter = layers.terrain;
  if (ter && !ter.error) {
    const label = hasValidatedTerrainBathymetry(ter) && ter.is_ocean === true
      ? `Validated depth ${cElev(Math.abs(ter.elevation_at_point))} ${uL('elev')} (water)`
      : `Terrain elevation ${cElev(ter.elevation_at_point)} ${uL('elev')} (surface class ${terrainSurfaceLabel(ter)})`;
    html += `<div class="sensor-section">
      <div class="sensor-section-title">TERRAIN <span class="badge-model">MODEL</span></div>
      <div class="sensor-row"><span class="sense-verb">Terrain:</span> <span class="sense-value">${label}</span></div>
      <div class="sensor-row"><span class="sense-verb">Elevation profile:</span> <span class="sense-value">${(ter.depth_profile || []).map(d => cElev(d) + uL('elev')).join(', ') || 'unavailable'}</span></div>
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
    const airQualityObservations = sourceObservationSummaries(aqSource);
    const uvWarn = aq.uv_index >= 8 ? ' Very High' : aq.uv_index >= 6 ? ' High' : '';
    html += `<div class="sensor-section">
      <div class="sensor-section-title">AIR QUALITY ${sourceBadge(aqSource, 'FUSED', aq)}</div>
      <div class="sensor-row"><span class="sense-verb">AQI:</span> <span class="sense-value">${aq.european_aqi} | PM2.5: ${aq.pm2_5} µg/m³</span></div>
      <div class="sensor-row"><span class="sense-verb">UV Index:</span> <span class="sense-value">${aq.uv_index}${escHtml(uvWarn)}</span></div>
      <div class="sensor-row"><span class="sense-verb">Source:</span> <span class="sense-value">${escHtml(sourceSummary(aqSource, aq))}</span></div>
      ${airQualityObservations.map(item => `<div class="sensor-row"><span class="sense-verb">Observed:</span> <span class="sense-value">${escHtml(item)}</span></div>`).join('')}
    </div>`;
  }

  // ── EXTENDED: Weather Alerts ──
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
  const windSensors = localSources(ext.wind_sensors, 'wind');
  if (windSensors.length > 0) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">OBSERVED WIND SENSORS <span class="badge-hw">HARDWARE</span></div>`;
    for (const s of windSensors.slice(0, 3)) {
      html += `<div class="sensor-row"><span class="sense-verb">[${escHtml(s.source.toUpperCase())}]</span> <span class="sense-value">${escHtml(s.name)} (${s.distance_km}km)</span></div>`;
      if (s.wind_speed_kmh != null) {
        // Always convert using the unit helper
        html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">${cWind(s.wind_speed_kmh)} ${uL('wind')}`;
        if (s.wind_direction != null) html += ` from ${s.wind_direction}°`;
        if (s.wind_gust_kmh != null) html += ` (gusts ${cWind(s.wind_gust_kmh)})`;
        html += `</span></div>`;
      }
      if (s.source === 'windy') {
        const operatorUrl = safeExternalHttpUrl(s.station_operator_url);
        const stationUrl = safeExternalHttpUrl(s.station_detail_url);
        const addStationUrl = safeExternalHttpUrl(s.add_station_url) || 'https://stations.windy.com/';
        const attribution = escHtml(s.attribution || 'Windy');
        const operator = operatorUrl
          ? `<a href="${escHtml(operatorUrl)}" target="_blank" rel="noopener noreferrer">${attribution}</a>`
          : attribution;
        const stationLink = stationUrl
          ? ` | <a href="${escHtml(stationUrl)}" target="_blank" rel="noopener noreferrer">Station details</a>`
          : '';
        html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">Source: ${operator}${stationLink} | <a href="${escHtml(addStationUrl)}" target="_blank" rel="noopener noreferrer">Add new station</a></span></div>`;
      }
    }
    if (ext.wind_cross_reference) {
      const xr = ext.wind_cross_reference;
      html += `<div class="sensor-row" style="margin-top:6px"><span class="sense-verb">Cross-ref:</span> <span class="sense-value">${xr.sensor_count} sensors avg ${cWind(xr.average_kmh)} ${uL('wind')} (${cWind(xr.min_kmh)}-${cWind(xr.max_kmh)})</span></div>`;
    }
    html += `</div>`;
  } else {
    const modelWindAvailable = layers.atmosphere?.current?.wind_speed_10m != null;
    const missingWindText = modelWindAvailable
      ? 'No nearby observed wind sensor. Showing current model context; it is not a hardware reading.'
      : 'No nearby observed wind sensor, and current model wind is unavailable. Wind is unknown.';
    html += `<div class="sensor-section"><div class="sensor-section-title">OBSERVED WIND SENSORS</div><div class="sensor-row"><span class="sense-value" style="color:var(--text2)">${escHtml(missingWindText)}</span></div></div>`;
  }

  const canonicalWindIds = new Set(windSensors
    .map(sensor => sensor.station_id || sensor.id)
    .filter(Boolean));
  const contextualMetar = (Array.isArray(ext.metar_stations) ? ext.metar_stations : [])
    .filter(station => !canonicalWindIds.has(station.station_id || station.id));
  if (contextualMetar.length > 0) {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">METAR <span class="badge-model">REGIONAL CONTEXT</span></div>
      <div class="sensor-row"><span class="sense-value" style="color:var(--text2)">Fresh official aviation observations are retained, but these stations are too distant or site-mismatched to anchor spot wind.</span></div>`;
    for (const station of contextualMetar.slice(0, 3)) {
      const wind = station.wind_speed_kmh == null
        ? 'wind unavailable'
        : `${cWind(station.wind_speed_kmh)} ${uL('wind')}${station.wind_direction != null ? ` from ${compactDirection(station.wind_direction)}` : ''}`;
      html += `<div class="sensor-row"><span class="sense-verb">${escHtml(station.station_id || station.name || 'METAR')}:</span> <span class="sense-value">${escHtml(wind)} | ${escHtml(String(station.distance_km ?? '?'))}km${station.updated ? ` | ${escHtml(station.updated)}` : ''}</span></div>`;
    }
    html += `</div>`;
  }

  const rapidWind = sourceHasErrorStatus(ext.tempest_rapid_wind) ? null : ext.tempest_rapid_wind;
  if (rapidWind) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">TEMPEST RAPID WIND <span class="badge-hw">3 SEC</span></div>
      <div class="sensor-row"><span class="sense-verb">Device:</span> <span class="sense-value">${escHtml(String(rapidWind.device_id || 'configured'))}</span></div>`;
    if (rapidWind.wind_speed_kmh != null) {
      html += `<div class="sensor-row"><span class="sense-verb">Snapshot:</span> <span class="sense-value">${cWind(rapidWind.wind_speed_kmh)} ${uL('wind')}${rapidWind.wind_direction != null ? ` from ${escHtml(compactDirection(rapidWind.wind_direction))}` : ''}${rapidWind.observed_at ? ` | ${escHtml(rapidWind.observed_at)}` : ''}</span></div>`;
    }
    html += `<div class="sensor-row"><span class="sense-value" style="color:var(--text2)">Configured-device stream snapshot for gust-sensitive local spots.</span></div></div>`;
  }

  // ── EXTENDED: Ocean Buoys ──
  const buoys = localSources(ext.buoys, 'buoy');
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

  // ── EXTENDED: Moving Ship Observations ──
  const ships = localSources(ext.ship_observations, 'ship');
  if (ships.length > 0) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">SHIP OBSERVATIONS <span class="badge-model">MOBILE</span></div>
      <div class="sensor-row"><span class="sense-value" style="color:var(--text2)">Moving marine hardware. Offshore comparison only, not the beach anchor. NOAA/NDBC often anonymizes vessel names as SHIP.</span></div>`;
    for (const ship of ships.slice(0, 3)) {
      const age = ship.age_minutes != null ? `, ${ship.age_minutes} min old` : '';
      html += `<div class="sensor-row"><span class="sense-verb">${escHtml(shipDisplayName(ship))}:</span> <span class="sense-value">${ship.distance_km}km away${escHtml(age)}</span></div>`;
      if (ship.identity_status === 'anonymized_by_noaa_ndbc') {
        html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value" style="color:var(--text2)">Vessel name unavailable in public NDBC feed; label is report position/time.</span></div>`;
      } else if (ship.vessel_name || ship.call_sign) {
        html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value" style="color:var(--text2)">Vessel: ${escHtml(ship.vessel_name || ship.call_sign)}${ship.call_sign && ship.call_sign !== ship.vessel_name ? ` | Call sign: ${escHtml(ship.call_sign)}` : ''}</span></div>`;
      }
      const bits = [];
      if (ship.wind_speed_kmh != null) {
        bits.push(`wind ${cWind(ship.wind_speed_kmh)} ${uL('wind')}${ship.wind_direction != null ? ` from ${compactDirection(ship.wind_direction)}` : ''}`);
      }
      if (ship.wave_height_m != null) bits.push(`waves ${cWave(ship.wave_height_m)} ${uL('wave')}${ship.wave_period_s != null ? ` / ${ship.wave_period_s}s` : ''}`);
      if (ship.pressure_hpa != null) bits.push(`pressure ${cPress(ship.pressure_hpa)} ${uL('press')}`);
      if (ship.water_temp_c != null) bits.push(`water ${cTemp(ship.water_temp_c)}${uL('temp')}`);
      if (bits.length) html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">${escHtml(bits.join(' | '))}</span></div>`;
    }
    html += `</div>`;
  } else if ((ext.ship_observations || []).length > 0) {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">SHIP OBSERVATIONS <span class="badge-model">FILTERED</span></div>
      <div class="sensor-row"><span class="sense-value" style="color:var(--text2)">Far offshore ship reports hidden; no mobile marine report within ${LOCAL_SOURCE_LIMITS_KM.ship}km of this spot.</span></div>
    </div>`;
  }

  // ── EXTENDED: NOAA Currents ──
  const currents = sourceHasErrorStatus(ext.currents) ? null : ext.currents;
  if (currents) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">COASTAL CURRENTS <span class="${currents.realtime_station?.current ? 'badge-hw' : 'badge-model'}">${currents.realtime_station?.current ? 'HARDWARE' : 'PREDICTED'}</span></div>`;
    if (currents.realtime_station?.current) {
      const station = currents.realtime_station;
      const current = station.current;
      html += `<div class="sensor-row"><span class="sense-verb">Meter:</span> <span class="sense-value">${escHtml(station.name)} (${station.distance_km}km)</span></div>`;
      html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">${cWind(current.speed_kmh)} ${uL('wind')} from ${escHtml(compactDirection(current.direction_deg))}${current.time_utc ? ` | ${escHtml(current.time_utc)}` : ''}</span></div>`;
    }
    if (currents.prediction_station?.current) {
      const station = currents.prediction_station;
      const current = station.current;
      html += `<div class="sensor-row"><span class="sense-verb">Prediction:</span> <span class="sense-value">${escHtml(station.name)} (${station.distance_km}km)</span></div>`;
      html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">${cWind(current.speed_kmh)} ${uL('wind')} from ${escHtml(compactDirection(current.direction_deg))}${current.time_utc ? ` | ${escHtml(current.time_utc)}` : ''}</span></div>`;
    }
    html += `</div>`;
  }

  // ── EXTENDED: Stormglass optional provider ──
  const stormglass = sourceHasErrorStatus(ext.stormglass_marine) ? null : ext.stormglass_marine;
  if (stormglass?.status === 'active_with_key') {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">STORMGLASS <span class="badge-model">OPTIONAL</span></div>`;
    if (stormglass.wave_height_m != null) html += `<div class="sensor-row"><span class="sense-verb">Wave:</span> <span class="sense-value">${cWave(stormglass.wave_height_m)} ${uL('wave')}${stormglass.wave_period_s != null ? ` / ${stormglass.wave_period_s}s` : ''}</span></div>`;
    if (stormglass.current_speed_mps != null) html += `<div class="sensor-row"><span class="sense-verb">Current:</span> <span class="sense-value">${stormglass.current_speed_mps} m/s${stormglass.current_direction != null ? ` from ${stormglass.current_direction}°` : ''}</span></div>`;
    if (stormglass.water_temp_c != null) html += `<div class="sensor-row"><span class="sense-verb">Water:</span> <span class="sense-value">${cTemp(stormglass.water_temp_c)}${uL('temp')}</span></div>`;
    html += `</div>`;
  }

  const worldTides = sourceHasErrorStatus(ext.world_tides) ? null : ext.world_tides;
  if (worldTides?.status === 'active_with_key') {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">WORLDTIDES <span class="badge-model">PREDICTED</span></div>`;
    if (worldTides.current_height_m != null) html += `<div class="sensor-row"><span class="sense-verb">Height:</span> <span class="sense-value">${cElev(worldTides.current_height_m)} ${uL('elev')}</span></div>`;
    if (worldTides.next_high) html += `<div class="sensor-row"><span class="sense-verb">Next high:</span> <span class="sense-value">${escHtml(worldTides.next_high.time)} (${cElev(worldTides.next_high.height_m)} ${uL('elev')})</span></div>`;
    if (worldTides.next_low) html += `<div class="sensor-row"><span class="sense-verb">Next low:</span> <span class="sense-value">${escHtml(worldTides.next_low.time)} (${cElev(worldTides.next_low.height_m)} ${uL('elev')})</span></div>`;
    html += `<div class="sensor-row"><span class="sense-value" style="color:var(--text2)">Global tide prediction fallback. Live tide gauges remain higher trust.</span></div></div>`;
  }

  const usgsWater = localSources(ext.usgs_water, 'water');
  if (usgsWater.length > 0) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">USGS WATER <span class="badge-hw">HARDWARE</span></div>`;
    for (const station of usgsWater.slice(0, 3)) {
      html += `<div class="sensor-row"><span class="sense-verb">${escHtml(station.station_id || 'Station')}:</span> <span class="sense-value">${escHtml(station.name || 'USGS water station')} (${station.distance_km}km)</span></div>`;
      for (const v of Object.values(station.variables || {}).slice(0, 3)) {
        html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">${escHtml(v.label || v.parameter_code)}: ${escHtml(String(v.value ?? 'n/a'))} ${escHtml(v.unit || '')}</span></div>`;
      }
    }
    html += `</div>`;
  }

  const webcams = localSources(ext.windy_webcams, 'webcam');
  if (webcams.length > 0) {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">VISUAL SPOT CHECK <span class="badge-model">WEBCAM</span></div>`;
    for (const cam of webcams.slice(0, 3)) {
      html += `<div class="sensor-row"><span class="sense-verb">${escHtml(cam.title || cam.webcam_id || 'Webcam')}:</span> <span class="sense-value">${cam.distance_km}km${cam.status ? ` | ${escHtml(cam.status)}` : ''}</span></div>`;
      const cameraUrl = safeExternalHttpUrl(cam.page_url);
      if (cameraUrl) html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value"><a href="${escHtml(cameraUrl)}" target="_blank" rel="noopener noreferrer">Open camera page</a></span></div>`;
    }
    html += `<div class="sensor-row"><span class="sense-value" style="color:var(--text2)">Visual confirmation helps verify whitecaps, shorebreak, squalls, crowding, and launch state.</span></div></div>`;
  }

  const openSenseMap = localSources(ext.opensensemap, 'community');
  if (openSenseMap.length > 0) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">OPENSENSEMAP <span class="badge-hw">COMMUNITY</span></div>`;
    for (const box of openSenseMap.slice(0, 3)) {
      html += `<div class="sensor-row"><span class="sense-verb">${escHtml(box.name || box.station_id)}:</span> <span class="sense-value">${box.distance_km}km${box.is_stale ? ' | stale' : ''}</span></div>`;
      for (const sensor of (box.sensors || []).slice(0, 3)) {
        html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">${escHtml(sensor.title || sensor.sensor_id)}: ${escHtml(String(sensor.value ?? 'n/a'))} ${escHtml(sensor.unit || '')}</span></div>`;
      }
    }
    html += `</div>`;
  }

  const copernicus = sourceHasErrorStatus(ext.copernicus_marine) ? null : ext.copernicus_marine;
  if (copernicus) {
    html += `<div class="sensor-section">
      <div class="sensor-section-title">COPERNICUS MARINE <span class="badge-model">ASYNC</span></div>
      <div class="sensor-row"><span class="sense-verb">Status:</span> <span class="sense-value">${escHtml(copernicus.status || 'configured')}</span></div>
      <div class="sensor-row"><span class="sense-value" style="color:var(--text2)">${escHtml(copernicus.note || 'Background ocean-data layer for cached regional context.')}</span></div>
    </div>`;
  }

  // ── EXTENDED: Water Temperature sensors ──
  const waterTemps = localSources(ext.water_temperature, 'water');
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
  const tides = sourceHasErrorStatus(ext.tides) ? null : ext.tides;
  if (tides) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">TIDE <span class="badge-hw">HARDWARE</span></div>
      <div class="sensor-row"><span class="sense-verb">Station:</span> <span class="sense-value">${escHtml(tides.name)} (${tides.distance_km}km)</span></div>`;
    if (tides.current_level_m != null) html += `<div class="sensor-row"><span class="sense-verb">Level:</span> <span class="sense-value">${cElev(tides.current_level_m)} ${uL('elev')} MLLW</span></div>`;
    if (tides.next_high) html += `<div class="sensor-row"><span class="sense-verb">Next high:</span> <span class="sense-value">${escHtml(tides.next_high.time)} (${cElev(tides.next_high.height_m)} ${uL('elev')})</span></div>`;
    if (tides.next_low) html += `<div class="sensor-row"><span class="sense-verb">Next low:</span> <span class="sense-value">${escHtml(tides.next_low.time)} (${cElev(tides.next_low.height_m)} ${uL('elev')})</span></div>`;
    html += `</div>`;
  }

  const iocSeaLevelGauges = Array.isArray(ext.ioc_sea_level_gauges) ? ext.ioc_sea_level_gauges : [];
  if (iocSeaLevelGauges.length > 0) {
    html += `<div class="sensor-section hw-border">
      <div class="sensor-section-title">IOC SEA LEVEL <span class="badge-hw">OBSERVED</span></div>
      <div class="sensor-row"><span class="sense-value" style="color:var(--text2)">Context only: provisional station-relative levels with no common vertical datum. Not a local tide prediction.</span></div>`;
    for (const gauge of iocSeaLevelGauges.slice(0, 2)) {
      const level = gauge.water_level_m == null ? 'level unavailable' : `${cElev(gauge.water_level_m)} ${uL('elev')}`;
      const age = gauge.age_minutes == null ? 'age unknown' : `${gauge.age_minutes} min old`;
      html += `<div class="sensor-row"><span class="sense-verb">${escHtml(gauge.name || gauge.station_id || 'Gauge')}:</span> <span class="sense-value">${escHtml(level)} | ${escHtml(age)} | ${escHtml(String(gauge.distance_km ?? '?'))}km</span></div>`;
      if (gauge.observed_at) html += `<div class="sensor-row" style="padding-left:36px"><span class="sense-value">Observed ${escHtml(gauge.observed_at)}</span></div>`;
    }
    html += `</div>`;
  }

  // ── EXTENDED: Space Weather ──
  const space = sourceHasErrorStatus(ext.space_weather) ? null : ext.space_weather;
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
    html += `<div class="sensor-row"><span class="sense-value">${escHtml(emptyFeedMessage('usgs_quakes', 'No earthquake events were returned within 500km.', 'Earthquake feed unavailable; event absence is unknown.'))}</span></div>`;
  }
  html += `</div>`;

  // ── EXTENDED: Fires ──
  const fires = ext.fires || [];
  html += `<div class="sensor-section">
    <div class="sensor-section-title">FIRES</div>`;
  if (fires.length > 0) {
    html += `<div class="sensor-row"><span class="sense-value" style="color:var(--red)">${fires.length} active fire(s) within 100km</span></div>`;
  } else {
    html += `<div class="sensor-row"><span class="sense-value">${escHtml(emptyFeedMessage('nasa_firms', 'No active-fire detections were returned within 100km.', 'Active-fire feed unavailable; fire absence is unknown.'))}</span></div>`;
  }
  html += `</div>`;

  // ── System Health Monitor ──
  const healthData = state.health || [];
  if (healthData.length > 0) {
    html += `<div class="sensor-section" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;margin-top:12px">
      <div class="sensor-section-title">SYSTEM HEALTH</div>`;
    for (const h of healthData) {
      const normalizedStatus = String(h.status || 'unknown').trim().toLowerCase();
      const statusLabel = normalizedStatus === 'ok' && h.has_data ? 'OK'
        : normalizedStatus === 'ok' || normalizedStatus === 'no_data' ? 'NO DATA'
        : normalizedStatus === 'not_applicable' ? 'NOT CONFIGURED'
        : normalizedStatus === 'error' ? 'ERROR' : normalizedStatus.toUpperCase();
      const latency = Number(h.latency_ms);
      const latColor = !Number.isFinite(latency) ? 'var(--text2)' : latency < 500 ? 'var(--green)' : latency < 2000 ? 'var(--yellow)' : 'var(--red)';
      html += `<div class="sensor-row" style="display:flex;justify-content:space-between;padding-right:8px">
        <span>${statusLabel} ${escHtml(h.source.replace(/_/g,' '))}</span>
        <span style="color:${latColor};font-size:11px">${Number.isFinite(latency) ? `${latency}ms` : 'n/a'}</span>
      </div>`;
    }
    html += `</div>`;
  }

  const sourceCount = Number(state.activeSources ?? 0);
  feed.innerHTML = `${renderDecisionCards(layers, ext, agreement)}
    <details class="sensor-details" open>
      <summary>All sensor measurements &amp; source details (${sourceCount} live)</summary>
      <div class="sensor-details-body">${html}</div>
    </details>`;

  // Staleness indicator
  const ts = document.getElementById('sensorTimestamp');
  if (ts) {
    const stale = stalenessLabel();
    ts.textContent = `Data fetched ${stale}`;
    const ageMinutes = state.pwmFetchedAt ? (Date.now() - state.pwmFetchedAt) / 60000 : 0;
    if (ageMinutes > 15) {
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

function addAiMessage(htmlContent, contextHtml = '') {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg ai';
  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = 'Senlay local guide';
  div.appendChild(label);
  const body = document.createElement('div');
  body.innerHTML = htmlContent; // htmlContent is already sanitized via renderMarkdown
  div.appendChild(body);
  if (contextHtml) {
    const context = document.createElement('div');
    context.innerHTML = contextHtml;
    div.appendChild(context);
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addAiError(message) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg ai';
  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = 'Senlay';
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
  div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div><span class="typing-text">Checking the live conditions...</span>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function normalizeHumanDemoAnswer(text) {
  return String(text || '')
    .trimStart()
    .replace(/^(?:#{1,6}\s*)?(?:\*\*)?\s*(?:bottom line|short answer)\s*(?:\*\*)?\s*:?\s*(?:\r?\n)+/i, '')
    .trimStart();
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
      provider: state.provider === 'demo' ? 'openrouter' : state.provider,
      audience: 'human_demo',
      responseMode: 'human_demo'
    };
    const headers = { 'Content-Type': 'application/json' };
    if (state.provider === 'profile') {
      body.savedLlmKeyId = state.profileDefaultKey?.id;
      headers.Authorization = `Bearer ${state.profileSessionToken}`;
    } else if (state.provider !== 'demo') {
      body.apiKey = state.apiKey;
    }

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await res.json();
    removeTyping();

    if (data.error) {
      addAiError(data.error);
    } else {
      const answer = data.response_mode === 'human_demo'
        ? normalizeHumanDemoAnswer(data.answer || '')
        : (data.answer || '');
      state.messages.push({ role: 'assistant', content: answer });
      addAiMessage(renderMarkdown(answer), renderLlmResponseContext(data));

      if (data.sensors) {
        state.sensors = data.sensors;
        state.satellite = data.satellite;
        state.extended = data.extended || state.extended;
        state.riskAssessment = data.risk_assessment || state.riskAssessment;
        state.riskSummary = data.risk_summary || state.riskSummary;
        state.riskEvents = data.risk_events || state.riskEvents;
        state.layerContext = data.layer_context || state.layerContext;
        state.layerCatalog = data.layer_catalog || state.layerCatalog;
        state.activeSources = data.active_sources ?? state.activeSources;
        // Don't update pwmFetchedAt here — data came from server cache, not fresh fetch
        renderLayerMap();
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
