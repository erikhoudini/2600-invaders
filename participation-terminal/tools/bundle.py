#!/usr/bin/env python3
"""Inline web/index.html's stylesheet and scripts into one self-contained HTML file.

Usage: python3 tools/bundle.py [output.html]   (default: dist/participation-terminal.html)
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'dist', 'participation-terminal.html')
    html = read('index.html')
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: '<style>\n' + read(m.group(1)) + '</style>', html)

    def script(m):
        src = read(m.group(1))
        if '</script' in src.lower():
            sys.exit('refusing to inline %s: contains </script' % m.group(1))
        return '<script>\n' + src + '</script>'

    html = re.sub(r'<script src="([^"]+)"></script>', script, html)
    if re.search(r'<script src=|<link rel="stylesheet"', html):
        sys.exit('unresolved external reference left in output')
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('wrote %s (%d KB)' % (out, len(html.encode('utf-8')) // 1024))


if __name__ == '__main__':
    main()
