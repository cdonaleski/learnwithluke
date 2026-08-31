#!/bin/sh
# Look at the site the way a browser really sees it.
#
# Opening index.html straight off the disk is NOT the same thing. Over file://
# a browser refuses to fetch neighbouring files and withholds crypto.subtle,
# so the club page cannot decrypt and no password will ever work there.
# http://localhost is treated as a secure context, so everything behaves.
#
#   scripts/serve.sh          then open http://localhost:8000
#   scripts/serve.sh 9000     if that port is busy
port="${1:-8000}"
root="$(cd "$(dirname "$0")/.." && pwd)"
echo "Serving $root"
echo
echo "  Home        http://localhost:$port/"
echo "  Cube club   http://localhost:$port/cube/club/index.html"
echo
echo "Press ctrl-c to stop."
cd "$root" && exec python3 -m http.server "$port"
