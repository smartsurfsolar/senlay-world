---
name: senlay
version: 1.2.0
description: Senlay is a sensory intelligence layer that connects AI agents to the physical world: weather, ocean, terrain, air quality, satellite data, sensor data, and environmental risk at real coordinates.
homepage: https://senlay.cloud
metadata: {"category":"physical_world_context","api_base":"https://senlay.cloud/api/v1","source_families":"21","source_count":"21"}
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

One verification request returns the Physical World Model (PWM): a unified response with live and model data, source provenance, freshness, confidence signals, interpretation, and an agent-ready `context_string`.

## Connect in 30 Seconds

### 0. No-key trial for browser/chat agents

If the agent can only open normal GET URLs and cannot send POST bodies or Bearer headers, use the public trial endpoint:

```text
https://senlay.cloud/api/v1/try-sense?lat=15.8801&lng=108.3380&field=kitesurfing&agentName=YourAgentName
```

Add `request=...` when the agent has a specific user task. This embeds the task into the plaintext response alongside the field/domain context:

```text
https://senlay.cloud/api/v1/try-sense?lat=15.8801&lng=108.3380&field=kitesurfing&agentName=YourAgentName&request=Can%20I%20kite%20safely%20now%3F
```

For a self-updating browser page, use:

```text
https://senlay.cloud/agents/live?lat=15.8801&lng=108.3380&field=kitesurfing&agentName=YourAgentName&request=Can%20I%20kite%20safely%20now%3F
```

The live page keeps state in the URL, including a `session` value, so multiple agents can query different locations/domains in parallel without overwriting one another. The plaintext endpoint is IP-limited and intended for demos only: 8 requests/minute burst and 60 requests/hour per IP. The live page clamps automatic refresh to 120-600 seconds. For repeated or production use, register for a key.

### 1. Get a free API key

Minimal agent registration:

```bash
curl -X POST https://senlay.cloud/api/v1/agent-register \
  -H "Content-Type: application/json" \
  -d '{"agentName": "YourAgentName"}'
```

Stable registration for repeat use:

```bash
curl -X POST https://senlay.cloud/api/v1/agent-register \
  -H "Content-Type: application/json" \
  -d '{"ownerEmail": "REPLACE_WITH_REAL_EMAIL", "agentName": "YourAgentName"}'
```

Response:

```json
{
  "success": true,
  "apiKey": "sl_live_xxxxxxxxxxxxxxxx",
  "keyPreview": "sl_live_xxxx…xxxx",
  "recoveryToken": "sl_recover_xxxxxxxxxxxxxxxx",
  "agentName": "YourAgentName",
  "existing": false,
  "rotated": false,
  "message": "Save the API key and recovery token now; neither is shown again."
}
```

Save both credentials in your secret store or environment variables. Do not paste them into logs, chats, GitHub, public pages, or a shared agent memory file. For an existing `(ownerEmail, agentName)` identity, send the current `recoveryToken` to rotate both credentials; the old API key is invalidated.

### 2. Get agent-ready context

```bash
curl -H "Authorization: Bearer sl_live_your_key" \
  "https://senlay.cloud/api/v1/sense?lat=36.01&lng=-5.60&field=drone"
```

This returns a plain-text physical-context block. Inject it into your agent prompt or tool result when the agent needs current conditions.

### 3. Get structured JSON

```bash
curl -H "Authorization: Bearer sl_live_your_key" \
  "https://senlay.cloud/api/v1/pwm?lat=36.01&lng=-5.60&field=drone"
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
| Terrain | Land elevation, slope, and terrain profile; no ocean depth unless a separate validated bathymetry layer is present | Model |
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
https://senlay.cloud/api/v1
```

Authentication:

```text
Authorization: Bearer sl_live_your_key
```

Never send your API key to any domain other than `senlay.cloud`.

### POST /api/v1/agent-register

No password required. The initial response returns an API key and recovery token once. Re-registering the same `ownerEmail` and `agentName` requires the current recovery token and rotates both credentials; it never reveals the old key.

### POST /api/v1/agent-lookup

Requires an account session bearer token plus a verified sign-in identity whose email exactly matches `ownerEmail`. Password-only accounts remain fail-closed until an explicit email-verification/link flow is completed. The route returns masked key metadata only; API keys and recovery tokens are never returned.

### GET /api/v1/sense?lat=&lng=

Plain-text spot-level verification. Best for LLM prompt injection.

Optional `field` parameter tunes the context for the task, such as `drone`, `kitesurfing`, `sailing`, `agriculture`, `running`, or `general`.

### GET /api/v1/try-sense?lat=&lng=

No-key browser/chat-agent trial endpoint. Returns the same style of plain-text context plus instructions for the model. Rate-limited and not intended for production automation.

Optional parameters:
- `field`: tunes the context for a domain, such as `kitesurfing`, `drone`, `agriculture`, or `general`.
- `agentName`: shown in the response and used for the trial rate-limit bucket.
- `request`: embeds the agent/user task into the response.
- `view=live`: opens the self-updating HTML page.

### GET /api/v1/pwm?lat=&lng=

Structured Physical World Model JSON.

### GET /api/v1/stats

Public usage counters.

```bash
curl https://senlay.cloud/api/v1/stats
```

## Rate Limits

| Tier | Limit | Price |
|---|---:|---:|
| Free Developer | 100 API calls/day | $0 |
| Agent / IoT Developer | 10,000 API calls/day | $29/month |
| Safety Pilot | 10,000 API calls/day by default; custom limits by agreement | From $199/month |
| Enterprise | Custom limits and pilot support | Custom |

Daily usage is enforced per account and is shared by all active Senlay API keys on that account; creating another key does not create another allowance.

## Tool Definition

```json
{
  "name": "get_physical_world_context",
  "description": "Get live spot-level verification for a coordinate using Senlay. Returns weather, wind, waves, terrain, air quality, hazards, source metadata, freshness, confidence, and interpretation for real-world decision support.",
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

- API docs: https://senlay.cloud/docs.html
- Demo: https://senlay.cloud/demo
- API key: https://senlay.cloud/register.html
- Contact: https://senlay.cloud/support.html

Source: Senlay - Physical-World Verification API for AI Agents. Built by Viktor Kryvotsiuk in Hoi An, Vietnam.
