# Senlay API examples

## Browser URL / no-key agent trial

```text
https://senlay.cloud/api/v1/try-sense?lat=15.8801&lng=108.3380&field=kitesurfing&agentName=ExampleAgent&request=Can%20I%20kite%20safely%20now%3F
```

## Live self-updating page

```text
https://senlay.cloud/agents/live?lat=15.8801&lng=108.3380&field=kitesurfing&agentName=ExampleAgent&request=Can%20I%20kite%20safely%20now%3F
```

## curl: plain-text verification context

```bash
curl -H "Authorization: Bearer sl_live_your_key" \
  "https://senlay.cloud/api/v1/sense?lat=36.01&lng=-5.60&field=drone"
```

## curl: structured JSON

```bash
curl -H "Authorization: Bearer sl_live_your_key" \
  "https://senlay.cloud/api/v1/pwm?lat=36.01&lng=-5.60&field=drone"
```

## curl: operational risk events

```bash
curl -H "Authorization: Bearer sl_live_your_key" \
  "https://senlay.cloud/api/v1/risk-events?lat=15.8801&lng=108.3380&field=kitesurfing"
```

The current risk endpoint requires `lat` and `lng` and derives events for that coordinate. It does not support a `status` query filter. Use `/api/v1/risk-events/recent` for persisted records and its documented type, severity, subject, time-window, and optional location filters.

## JavaScript fetch

```js
const res = await fetch(
  "https://senlay.cloud/api/v1/pwm?lat=36.01&lng=-5.60&field=drone",
  { headers: { Authorization: `Bearer ${process.env.SENLAY_API_KEY}` } }
);
const data = await res.json();
console.log(data.context_string || data.pwm?.context_string);
```

## Python requests

```python
import os
import requests

url = "https://senlay.cloud/api/v1/sense"
params = {"lat": 36.01, "lng": -5.60, "field": "drone"}
headers = {"Authorization": f"Bearer {os.environ['SENLAY_API_KEY']}"}

response = requests.get(url, params=params, headers=headers, timeout=30)
response.raise_for_status()
print(response.text)
```

## Example LLM system prompt

```text
You are an AI agent with access to Senlay, a physical-world verification API. Before answering any question about current outdoor, marine, drone, field, agriculture, SmartSurf-style safety, or weather-sensitive decisions, request live physical context from Senlay. Use Senlay's source evidence, freshness, confidence, uncertainty, and risk_event context in your answer. Do not invent missing measurements. Do not claim guaranteed safety.
```

## Example agent behavior

Before answering a physical-world safety question, call Senlay if the user provides a location and use case. If no location is available, ask for location first. If Senlay data is missing or uncertain, say so clearly and avoid guaranteed safety claims. If the workflow is operational, check whether a risk_event is active before recommending escalation.
