#!/usr/bin/env bash
# Render every kaiju headlessly and print stats + ASCII silhouettes.
cd "$(dirname "$0")/.." && timeout 180 chromium --headless=new --no-sandbox --disable-gpu \
  --dump-dom tools/render-check.html 2>/dev/null |
  python3 -c "
import sys,re,html
d=sys.stdin.read()
m=re.search(r'<pre id=\"out\">(.*?)</pre>',d,re.S)
print(html.unescape(m.group(1)) if m else 'NO OUTPUT (%d bytes)'%len(d))"
