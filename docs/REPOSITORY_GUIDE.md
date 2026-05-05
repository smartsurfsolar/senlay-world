# Repository Guide

This repository is intentionally structured so GitHub visitors see the project clearly before they see implementation files.

## Root

The root contains project-level material:

- `README.md` - main product and repository introduction
- `LICENSE` - ownership terms
- `SECURITY.md` - sensitive material policy
- `CONTRIBUTING.md` - contribution boundaries
- `docs/` - product and repository notes
- `public/` - deployable static site

## Public Site

The `public/` folder is the website root. If it is deployed by GitHub Pages or copied to a static host, `public/index.html` should become the site homepage.

```text
public/
  assets/brand/
  assets/founder-selected/
  scripts/
  styles/
  index.html
  founder.html
  docs.html
  agents.html
```

## Asset Policy

Only curated public assets belong in this repository. Raw media, private family material, experiments, and large unprocessed source folders should stay outside GitHub or in private storage.

## Backend Boundary

The private backend repository owns:

- API server
- database and auth code
- sensor fusion logic
- deployment templates
- runtime configuration

This public repository owns:

- product story
- website presentation
- public docs
- public static assets
