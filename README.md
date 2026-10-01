# Financiën website

Informatieve website over persoonlijke financiën, gebouwd met [Astro](https://astro.build) en gehost op GitHub Pages:
https://tiesvdsar.github.io/financi-n_website/

## Aan de slag

```sh
npm install
npm run dev       # lokale server op http://localhost:4321/financi-n_website/
npm run build     # type-check + productie-build naar dist/
npm run preview   # bekijk de build lokaal
```

## Projectstructuur

```
.github/workflows/deploy.yml   Automatische deploy naar GitHub Pages bij push naar main
public/                        Statische bestanden (favicon, afbeeldingen), 1-op-1 gekopieerd
src/
  components/                  Herbruikbare UI-onderdelen (Header, Footer, ArticleCard)
  content/artikelen/           Artikelen als Markdown-bestanden
  content.config.ts            Schema (frontmatter-velden) voor artikelen
  layouts/BaseLayout.astro     Basis-HTML: <head>, SEO-meta, header en footer
  pages/                       Elk bestand = een route (index, over, artikelen/..., 404)
  styles/global.css            Globale stijlen en kleurvariabelen (licht/donker)
  utils/                       Helpers (base-URL, datumnotatie, artikelen ophalen)
astro.config.mjs               Site-URL en base-pad voor GitHub Pages
```

## Een artikel toevoegen

Maak een nieuw bestand in `src/content/artikelen/`, bijv. `noodfonds.md`:

```md
---
title: Waarom een noodfonds?
description: Hoeveel buffer heb je nodig?
pubDate: 2026-10-15
category: Sparen        # Budgetteren | Sparen | Beleggen | Belastingen | Schulden | Overig
draft: false            # true = alleen zichtbaar tijdens npm run dev
---

Tekst van het artikel...
```

Het artikel verschijnt automatisch op `/artikelen/noodfonds/`.

## Interne links

Gebruik voor interne links altijd de `url()`-helper uit `src/utils/url.ts`, zodat het base-pad
`/financi-n_website/` van GitHub Pages klopt.

## Deployen

1. Ga op GitHub naar **Settings → Pages** en kies bij *Source* **GitHub Actions** (eenmalig).
2. Push naar `main`. De workflow bouwt en publiceert de site automatisch.
