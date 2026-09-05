# Senlay context

Senlay is a reciprocal verification network for AI agents, IoT systems, and safety applications. It tells systems what is happening at a coordinate, right now, and how much to trust the answer, from evidence contributed by the people who use it. Contribute a sensor and get the whole network back; consume without contributing and pay.

## What makes Senlay different

A weather API usually returns values. Senlay returns evidence-bearing verification:

- measured/model conditions
- source identity
- source type
- distance from source
- timestamp and freshness
- confidence
- hardware/model disagreement
- operational `risk_event` alerts for station/lifeguard workflows
- domain interpretation
- `context_string` for LLMs
- structured JSON for applications

## Why agents and safety apps need it

Agents can reason, plan, write, and automate, but they do not directly sense wind, waves, weather, tides, terrain, air quality, visibility, lightning, fire, device movement, or sensor freshness. For "right now" physical-world questions, training data and generic forecasts are not enough. SmartSurf is the first proving ground, not the ceiling: GPS movement from riders and boards becomes safer when Senlay adds environmental evidence and risk context. The same evidence engine reasons for any system that acts outside and would never install a weather station itself.

## Source families

Senlay uses "21 source families" as the standard wording. Availability varies by location and configured tier. Some source families are active by default, some require optional provider keys, partner access, licensing review, or attribution. Marine/watersports context may include buoys, ship observations, tide gauges, current meters/predictions, USGS river/inlet stations, webcam visual checks, global tide prediction fallbacks, and cached ocean-background layers when configured.

## API quickstart

No-key trial:

```bash
curl "https://senlay.cloud/api/v1/try-sense?lat=15.8801&lng=108.3380&field=kitesurfing&request=Can%20I%20kite%20safely%20now%3F"
```

Authenticated plain-text context:

```bash
curl -H "Authorization: Bearer sl_live_your_key" \
  "https://senlay.cloud/api/v1/sense?lat=36.01&lng=-5.60&field=drone"
```

Authenticated structured JSON:

```bash
curl -H "Authorization: Bearer sl_live_your_key" \
  "https://senlay.cloud/api/v1/pwm?lat=36.01&lng=-5.60&field=drone"
```

Authenticated risk events:

```bash
curl -H "Authorization: Bearer sl_live_your_key" \
  "https://senlay.cloud/api/v1/risk-events?lat=15.8801&lng=108.3380&field=kitesurfing"
```

The current risk endpoint requires coordinates and does not accept `status` as a query filter. Use `/api/v1/risk-events/recent` when you need persisted records and supported audit filters.

## Safety

Senlay provides evidence, context, risk-event support, and decision support. It is not a final safety authority. Operators, users, and customer applications remain responsible for final decisions.
