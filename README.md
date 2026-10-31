# Effendi Kebab · Tübingen

Website-Konzept von MI Visuals: Scroll-Film (Spieß → Fleischspirale → Explosionszeichnung → fertiger Döner), Lavastein-Grill-Loop, Karte, Anfahrt.

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
