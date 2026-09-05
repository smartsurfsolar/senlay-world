<p align="center">
  <img src="public/assets/brand/SenlayLogo-header.png" alt="Senlay" width="220">
</p>

# Senlay — Verified Physical Context

Senlay provides verified physical context for systems that act outside. This repository contains the public website for the Senlay verification network.

Senlay gives AI agents real-time awareness of weather, ocean, terrain, air quality, satellite data, sensor data, and physical-world context. It is built for developers and AI teams that need current conditions, source, freshness, confidence, and interpretation before software makes a real-world decision.

[senlay.cloud](https://senlay.cloud) · [API Docs](https://senlay.cloud/docs.html) · [Open Network SDK](https://github.com/smartsurfsolar/senlay-platform) · [Founder Story](public/founder.html)

## Why It Matters

AI can reason about the world, but it still needs reliable contact with current physical conditions. Senlay turns live environmental data into context that agents can use when decisions depend on place, weather, water, terrain, timing, or safety.

## What Is Here

This repository contains the public Senlay website:

```text
public/
  assets/       Brand and selected story media
  scripts/      Front-end JavaScript
  styles/       Shared CSS
  index.html    Main landing page
  docs.html     API documentation
  founder.html  Founder story
```

## Preview Locally

`main` holds stable website releases; `develop` holds public website development. The historical repository name is retained; the website and API domain is `senlay.cloud`.

The backend, authentication, admin services, provider secrets and memory corpus live in the separate private `senlay-platform-core` repository. This repository's license applies to website content; the separate Open Network SDK uses Apache-2.0. Never merge private backend history into this public repository.

```bash
cd public
python3 -m http.server 8080
```

Then open:

```text
http://127.0.0.1:8080
```

This previews static pages. Use `.html` page URLs locally; extensionless routes, API calls, authentication and `/vendor/maplibre-gl/` assets are supplied by the production backend and are not implemented by Python's static server.

## Product Pages

- `public/index.html` - Senlay overview
- `public/docs.html` - public API documentation
- `public/agents.html` - AI agent onboarding
- `public/moltbook.html` - Moltbook-focused agent page
- `public/founder.html` - founder story
- `public/pricing.html` - pricing direction
- `public/support.html` - support and contact

## Contact

- Email: [viktor@senlay.cloud](mailto:viktor@senlay.cloud)
- WhatsApp: [+84 3333 801 68](https://wa.me/84333380168)
- LinkedIn: [Viktor Kryvotsiuk](https://www.linkedin.com/in/viktor-kryvotsiuk-0b7449151/)
- Ko-fi: [ko-fi.com/senlay](https://ko-fi.com/senlay)

## Ownership

Copyright 2026 Senlay / SmartSurf Solar. All rights reserved.
