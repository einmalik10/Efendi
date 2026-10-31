# Effendi Kebab · Tübingen

Website-Konzept von MI Visuals: Scroll-Film (Spieß → Fleischspirale → Explosionszeichnung → fertiger Döner), Lavastein-Grill-Loop, Karte, Anfahrt.

**Vorschau:** https://einmalik10.github.io/Efendi/ (noindex, Platzhalter-Inhalte)

**PageSpeed Insights (31.10.2026):** Handy 98 / 100 / 100 · Desktop 100 / 100 / 100 (Leistung / Barrierefreiheit / Best Practices). SEO 60 nur wegen `noindex`, vor dem echten Start entfernen.
Bericht: https://pagespeed.web.dev/analysis/https-einmalik10-github-io-Efendi/rjze1vbqcp

## Lokal ansehen
```bash
python3 -m http.server 8123
```
Dann http://localhost:8123 öffnen (direkt als Datei geöffnet laden die Bilder nicht).

## Aufbau
- `index.html`, `style.css`, `main.js`: Seite, Mobile zuerst
- `assets/seq-desktop/`, `assets/seq-mobile/`: Bildsequenz des Scroll-Films (153 WebP, Handy lädt jedes 2.)
- `assets/keys/`: drei Standbilder als Rückfall, bis die Sequenz geladen ist
- `assets/lavagrill.mp4`: Lavagrill-Loop

Technik: GSAP ScrollTrigger, Lenis, Canvas. Bilder und Videos mit Higgsfield generiert (Platzhalter, Kunde entscheidet über finale Motive). Preise, Adresse und Öffnungszeiten sind noch Platzhalter.
