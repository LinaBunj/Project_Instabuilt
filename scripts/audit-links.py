#!/usr/bin/env python3
"""
Audit every internal link, image and asset reference across the InstaBuilt site.
Verifies that each resolves to a real file on disk (zero 404s).

Usage:  python scripts/audit-links.py
"""
import os
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGES = [
    "index.html", "popup-solutions.html", "multistory-multifamily.html",
    "senior-housing.html", "micro-apartments.html", "traditional-homes.html",
    "signature-homes.html", "bathpods.html", "construction-system.html",
    "sustainability.html", "about-us.html", "career.html",
    "innovation-center.html", "blog.html", "news.html", "contact.html", "404.html",
    "login.html", "signup.html",
    "dashboard/index.html", "dashboard/house-designer.html",
    "dashboard/price-calculator.html", "dashboard/energy-calculator.html",
    "dashboard/smart-home-configurator.html", "dashboard/profile.html",
    "dashboard/coming-soon.html", "dashboard/project-tracking.html",
]


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []  # (attr, value)
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        for attr in ("href", "src", "srcset", "action", "poster"):
            if attr in d:
                self.refs.append((attr, d[attr]))


def resolve(base_dir, ref):
    ref = ref.strip()
    if not ref:
        return None
    if ref.startswith(("#", "//")):
        return None
    if ref.startswith(("mailto:", "tel:", "data:", "javascript:")):
        return None
    if "://" in ref:
        return None
    path = ref.split("#", 1)[0].split("?", 1)[0]
    if not path:
        return None  # pure in-page anchor
    if path.startswith("/"):
        return os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
    return os.path.normpath(os.path.join(base_dir, path))


def exists(target):
    if os.path.isfile(target):
        return True
    if os.path.isdir(target) and os.path.isfile(os.path.join(target, "index.html")):
        return True  # "/" -> index.html
    return False


def main():
    problems = []
    checked = 0
    for page in PAGES:
        fpath = os.path.join(ROOT, page)
        if not os.path.isfile(fpath):
            problems.append(f"MISSING PAGE: {page}")
            continue
        parser = LinkParser()
        with open(fpath, encoding="utf-8") as f:
            parser.feed(f.read())
        base_dir = os.path.dirname(fpath)
        for attr, ref in parser.refs:
            refs = []
            if attr == "srcset":
                refs = [p.strip().split(" ")[0] for p in ref.split(",")]
            else:
                refs = [ref]
            for r in refs:
                target = resolve(base_dir, r)
                if target is None:
                    continue
                checked += 1
                if not exists(target):
                    problems.append(f"{page}: {attr}=\"{ref}\" -> {target}")

    print(f"Checked {checked} internal references across {len(PAGES)} pages.")
    if problems:
        print("PROBLEMS FOUND:")
        for p in problems:
            print("  - " + p)
        raise SystemExit(1)
    print("OK — every internal link/image/asset resolves to a real file.")


if __name__ == "__main__":
    main()
