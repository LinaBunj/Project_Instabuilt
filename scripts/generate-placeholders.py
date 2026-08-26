#!/usr/bin/env python3
"""
Generate the InstaBuilt placeholder image set.

Every SVG is a clearly-labelled architectural placeholder: a muted earth-tone
wash, a modular line-art motif, and the intended content described in text.
When real photography/renders arrive in Phase 2, drop files with the SAME names
into the same folders and the site picks them up without touching the markup.

Usage:  python scripts/generate-placeholders.py
"""

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "images")

# slug-dir, filename, full label ("Title — Subtitle")
IMAGES = [
    # Home
    ("home", "hero-home.svg", "Hero — Modular home exterior"),
    ("home", "factory.svg", "Offsite production — Precision manufacturing line"),
    ("home", "site-assembly.svg", "Site assembly — Up to 75% faster"),
    ("home", "kfw40-facade.svg", "Sustainability — KfW40 facade detail"),
    # POP UP Solutions
    ("popup-solutions", "hero.svg", "Hero — POP UP Solutions exterior"),
    ("popup-solutions", "plan-28.svg", "POP UP 28 — Floor plan 28 m²"),
    ("popup-solutions", "plan-52.svg", "POP UP 52 — Floor plan 52 m²"),
    ("popup-solutions", "plan-104.svg", "POP UP 104 — Floor plan 104 m²"),
    ("popup-solutions", "gallery-1.svg", "Gallery — POP UP interior"),
    ("popup-solutions", "gallery-2.svg", "Gallery — POP UP exterior detail"),
    ("popup-solutions", "gallery-3.svg", "Gallery — POP UP site assembly"),
    # Multistory Multifamily
    ("multistory-multifamily", "hero.svg", "Hero — Multistory multifamily facade"),
    ("multistory-multifamily", "gallery-1.svg", "Gallery — Building envelope"),
    ("multistory-multifamily", "gallery-2.svg", "Gallery — Balcony detail"),
    ("multistory-multifamily", "gallery-3.svg", "Gallery — Site assembly"),
    # Senior Housing
    ("senior-housing", "hero.svg", "Hero — Senior housing courtyard"),
    ("senior-housing", "gallery-1.svg", "Gallery — Accessible unit interior"),
    ("senior-housing", "gallery-2.svg", "Gallery — Communal lounge"),
    ("senior-housing", "gallery-3.svg", "Gallery — Exterior gardens"),
    # Micro Apartments
    ("micro-apartments", "hero.svg", "Hero — Micro apartment building"),
    ("micro-apartments", "gallery-1.svg", "Gallery — Compact interior"),
    ("micro-apartments", "gallery-2.svg", "Gallery — Built-in storage"),
    ("micro-apartments", "gallery-3.svg", "Gallery — Shared amenities"),
    # Traditional Homes
    ("traditional-homes", "hero.svg", "Hero — Traditional gabled home"),
    ("traditional-homes", "gallery-1.svg", "Gallery — Exterior facade"),
    ("traditional-homes", "gallery-2.svg", "Gallery — Interior living space"),
    ("traditional-homes", "gallery-3.svg", "Gallery — Roof detail"),
    # Signature Homes
    ("signature-homes", "hero.svg", "Hero — Signature villa exterior"),
    ("signature-homes", "gallery-1.svg", "Gallery — Great room"),
    ("signature-homes", "gallery-2.svg", "Gallery — Facade detail"),
    ("signature-homes", "gallery-3.svg", "Gallery — Landscape"),
    # Bathpods
    ("bathpods", "hero.svg", "Hero — Bathpod factory unit"),
    ("bathpods", "gallery-1.svg", "Gallery — Bathpod interior"),
    ("bathpods", "gallery-2.svg", "Gallery — Factory production"),
    ("bathpods", "gallery-3.svg", "Gallery — Installation"),
    # Construction System
    ("construction-system", "hero.svg", "Hero — Construction system"),
    ("construction-system", "module-factory.svg", "Module production — Factory line"),
    ("construction-system", "module-transport.svg", "Logistics — Module transport"),
    ("construction-system", "module-assembly.svg", "Assembly — Crane placement"),
    ("construction-system", "quality.svg", "Quality — Precision engineering"),
    # Sustainability
    ("sustainability", "hero.svg", "Hero — Sustainable building"),
    ("sustainability", "kfw40.svg", "KfW40 — Energy standard"),
    ("sustainability", "materials.svg", "Materials — Sustainable sourcing"),
    ("sustainability", "lifecycle.svg", "Lifecycle — Circular economy"),
    ("sustainability", "energy.svg", "Energy — Renewable systems"),
    # About Us
    ("about-us", "hero.svg", "Hero — InstaBuilt team"),
    ("about-us", "team.svg", "Team — Collaboration"),
    ("about-us", "factory.svg", "Facilities — Production hall"),
    # Career
    ("career", "hero.svg", "Hero — Careers at InstaBuilt"),
    ("career", "culture.svg", "Culture — Workshop floor"),
    # Innovation Center
    ("innovation-center", "hero.svg", "Hero — Innovation Center"),
    ("innovation-center", "lab.svg", "Lab — Material testing"),
    ("innovation-center", "prototype.svg", "Prototype — Mock-up unit"),
    # Blog
    ("blog", "post-1.svg", "Article — Modular construction"),
    ("blog", "post-2.svg", "Article — Sustainability"),
    ("blog", "post-3.svg", "Article — Precision engineering"),
    ("blog", "post-4.svg", "Article — POP UP housing"),
    ("blog", "post-5.svg", "Article — Senior living"),
    ("blog", "post-6.svg", "Article — Offsite logistics"),
    # News
    ("news", "news-1.svg", "News — Project announcement"),
    ("news", "news-2.svg", "News — Partnership"),
    ("news", "news-3.svg", "News — Trade fair"),
    ("news", "news-4.svg", "News — Award"),
    # Contact
    ("contact", "hero.svg", "Contact — Head office"),
]

# Muted earth-tone washes (background gradient pairs), cycled for gentle variety.
WASHES = [
    ("#EBE4D6", "#DED3BE"),
    ("#E4DBC9", "#D5C8AE"),
    ("#DED5C2", "#CCBFA6"),
]


def _esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def building_motif(line):
    """Minimal modular line-art: three offset volumes with window grids."""
    parts = []
    # ground line
    parts.append(f'<line x1="110" y1="808" x2="1490" y2="808" stroke="{line}" '
                 'stroke-width="2" opacity="0.55"/>')
    volumes = [
        (340, 360, 320, 448, 3, 4),   # left, tall
        (680, 250, 340, 558, 4, 5),   # centre, tallest
        (1040, 500, 300, 308, 3, 3),  # right, low
    ]
    for (x, y, w, h, cols, rows) in volumes:
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" '
                     f'fill="none" stroke="{line}" stroke-width="2"/>')
        # window grid
        padx, pady = w * 0.10, h * 0.12
        gapx, gapy = w * 0.04, h * 0.06
        ww = (w - 2 * padx - (cols - 1) * gapx) / cols
        wh = (h - 2 * pady - (rows - 1) * gapy) / rows
        for r in range(rows):
            for c in range(cols):
                wx = x + padx + c * (ww + gapx)
                wy = y + pady + r * (wh + gapy)
                parts.append(f'<rect x="{wx:.1f}" y="{wy:.1f}" width="{ww:.1f}" '
                             f'height="{wh:.1f}" fill="none" stroke="{line}" '
                             'stroke-width="1.5" opacity="0.7"/>')
    return "".join(parts)


def make_svg(full_label, c1, c2):
    if "—" in full_label:
        title, subtitle = (p.strip() for p in full_label.split("—", 1))
    else:
        title, subtitle = full_label, ""
    title = _esc(title)
    subtitle = _esc(subtitle)
    line = "#8D806C"
    ink = "#4A4236"
    serif = "Georgia, 'Times New Roman', serif"
    # shrink title font if long
    fs = 58 if len(title) <= 26 else 46
    sub_block = ""
    if subtitle:
        sub_block = (f'  <text x="86" y="928" font-family="{serif}" '
                     f'font-size="34" fill="{ink}" opacity="0.72">{subtitle}</text>\n')
    title_y = 872 if subtitle else 860
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" '
        f'viewBox="0 0 1600 1000" role="img" aria-label="{_esc(full_label)}">\n'
        f'  <defs>\n'
        f'    <linearGradient id="w" x1="0" y1="0" x2="1" y2="1">\n'
        f'      <stop offset="0" stop-color="{c1}"/>\n'
        f'      <stop offset="1" stop-color="{c2}"/>\n'
        f'    </linearGradient>\n'
        f'  </defs>\n'
        f'  <rect width="1600" height="1000" fill="url(#w)"/>\n'
        f'  {building_motif(line)}\n'
        f'  <rect x="18" y="18" width="1564" height="964" fill="none" '
        f'stroke="{line}" stroke-width="3"/>\n'
        f'  <text x="86" y="132" font-family="{serif}" font-size="26" '
        f'letter-spacing="6" fill="{ink}" opacity="0.75">INSTABUILT · PLACEHOLDER</text>\n'
        f'  <text x="86" y="{title_y}" font-family="{serif}" font-size="{fs}" '
        f'fill="{ink}">{title}</text>\n'
        f'{sub_block}'
        f'</svg>\n'
    )


def main():
    for i, (slug, fname, label) in enumerate(IMAGES):
        d = os.path.join(IMG, slug)
        os.makedirs(d, exist_ok=True)
        c1, c2 = WASHES[i % len(WASHES)]
        svg = make_svg(label, c1, c2)
        with open(os.path.join(d, fname), "w", encoding="utf-8") as f:
            f.write(svg)
    print(f"Generated {len(IMAGES)} placeholders under {IMG}")


if __name__ == "__main__":
    main()
