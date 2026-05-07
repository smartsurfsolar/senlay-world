---
name: senlay
version: 1.2.0
description: Senlay is a sensory intelligence layer that connects AI agents to the physical world: weather, ocean, terrain, air quality, satellite data, sensor data, and environmental risk at real coordinates.
homepage: https://senlay.world
metadata: {"category":"physical_world_context","api_base":"https://senlay.world/api/v1","sensor_networks":"21","source_count":"21"}
---

# Senlay - Sensory Intelligence Layer for AI Agents

Senlay is a sensory intelligence layer that connects AI agents to the physical world.

It gives AI agents and applications current physical context for real-world decisions.

It is not a general search engine, not a consumer weather app, and not a universal answer machine. Senlay is for questions where measurable conditions matter: wind, waves, weather, tides, terrain, air quality, sensor data, satellite data, and environmental risk.

Use Senlay when an agent needs to answer questions like:

- Can a drone safely fly here now?
- Is this beach safe for kitesurfing?
- Are gusts, waves, tides, or currents risky?
- Is air quality safe for outdoor work?
- What conditions affect this farm, route, site, or operation?

One API call returns the Physical World Model (PWM): a unified response with live and model data, source provenance, freshness, confidence signals, interpretation, and an agent-ready `context_string`.

## Connect in 30 Seconds

### 1. Get a free API key

Minimal agent registration:

```bash
curl -X POST https://senlay.world/api/v1/agent-register \
  -H "Content-Type: application/json" \
  -d '{"agentName": "YourAgentName"}'
```

Stable registration for repeat use:

```bash
curl -X POST https://senlay.world/api/v1/agent-register \
  -H "Content-Type: application/json" \
  -d '{"ownerEmail": "REPLACE_WITH_REAL_EMAIL", "agentName": "YourAgentName"}'
```

Response:

```json
{
  "success": true,
  "apiKey": "sl_live_xxxxxxxxxxxxxxxx",
  "agentName": "YourAgentName",
  "existing": false,
  "message": "Save your API key - it cannot be recovered."
}
```

Save the key in your credential store or environment variables. Do not paste full keys into logs, chats, GitHub, or public pages.

### 2. Get agent-ready context

```bash
curl -H "Authorization: Bearer sl_live_your_key" \
  "https://senlay.world/api/v1/sense?lat=36.01&lng=-5.60"
```

This returns a plain-text physical-context block. Inject it into your agent prompt or tool result when the agent needs current conditions.

### 3. Get structured JSON

```bash
curl -H "Authorization: Bearer sl_live_your_key" \
  "https://senlay.world/api/v1/pwm?lat=36.01&lng=-5.60"
```

This returns raw layers, source metadata, calculated insights, and a `context_string`.

## Recommended Agent Behavior

Call Senlay before making a recommendation that depends on physical conditions.

Good uses:

- Drone pre-flight checks
- Marine and sailing routing
- Watersports safety checks
- Outdoor work planning
- Agriculture and field-condition analysis
- Hiking, trekking, and aviation-weather context
- Coastal risk, waves, tides, currents, and air quality checks

Do not use Senlay for:

- General web search
- Medical, legal, or financial advice
- Questions unrelated to measurable physical conditions
- Unsupported claims about human perception, consciousness, or biological sensing

## Physical World Model

The PWM can include:

| Layer | Context | Source Type |
|---|---|---|
| Atmosphere | Wind, gusts, temperature, humidity, pressure, precipitation | Model + hardware |
| Marine | Waves, swell, period, tides, currents, water temperature | Model + hardware |
| Terrain | Elevation, slope, ocean depth, terrain profile | Model |
| Air Quality | PM2.5, PM10, AQI, UV index | Model + hardware |
| Satellite | Fire proximity, imagery metadata, environmental events | Satellite |
| Sensors | METAR, buoys, tide gauges, private and citizen stations | Hardware |
| Hazards | Fires, earthquakes, alerts, radiation, volcanoes where available | Official feeds + sensors |
| Insights | Gust factor, wave energy, Beaufort scale, hazard flags, trends | Senlay fusion |

## Evidence Principle

Senlay separates measured observations from model predictions.

Hardware sensors such as METAR stations, ocean buoys, and tide gauges are treated as measured evidence. Forecast and environmental models are treated as predictions. When they disagree, Senlay exposes the source, freshness, distance, confidence, and discrepancy so the agent can reason about uncertainty instead of guessing.

## API Reference

Base URL:

```text
https://senlay.world/api/v1
```

Authentication:

```text
Authorization: Bearer sl_live_your_key
```

Never send your API key to any domain other than `senlay.world`.

### POST /api/v1/agent-register

No password required. Returns an API key. If the same `ownerEmail` and `agentName` were registered before, the same key is returned.

### POST /api/v1/agent-lookup

Lists agents registered under an email with masked key previews. Full keys are never returned.

### GET /api/v1/sense?lat=&lng=

Plain-text physical-world context. Best for LLM prompt injection.

### GET /api/v1/pwm?lat=&lng=

Structured Physical World Model JSON.

### GET /api/v1/stats

Public usage counters.

```bash
curl https://senlay.world/api/v1/stats
```

## Rate Limits

| Tier | Limit | Price |
|---|---:|---:|
| Free Beta | 100 API calls/day | $0 |
| Pro Developer | 10,000 API calls/month | $29/month |
| Startup / Team | 100,000+ API calls/month | From $199/month |
| Enterprise | Custom limits and pilot support | Custom |

## Tool Definition

```json
{
  "name": "get_physical_world_context",
  "description": "Get live physical-world context for a coordinate using Senlay. Returns weather, wind, waves, terrain, air quality, hazards, source metadata, freshness, confidence, and interpretation for real-world decision support.",
  "parameters": {
    "type": "object",
    "properties": {
      "lat": { "type": "number", "description": "Latitude from -90 to 90" },
      "lng": { "type": "number", "description": "Longitude from -180 to 180" }
    },
    "required": ["lat", "lng"]
  }
}
```

## Links

- API docs: https://senlay.world/docs.html
- Demo: https://senlay.world/demo
- API key: https://senlay.world/register.html
- Contact: https://senlay.world/support.html

Source: Senlay - Physical-World Context API for AI Agents. Built by Viktor Kryvotsiuk in Hoi An, Vietnam.
