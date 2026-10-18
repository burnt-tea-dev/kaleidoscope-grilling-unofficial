#!/usr/bin/env bash
# Read-only Phase-1 inventory of the senluo/luosen server (REBUILD-PLAN T1.4).
#
# Run from your own computer, saving the output locally:
#   ssh senluo-server 'curl -fsSL https://raw.githubusercontent.com/casama233/kaleidoscope-grilling-unofficial/main/tools/ops/collect_server_inventory.sh | bash' > luosen-inventory.txt
#
# It never writes outside /tmp, never stops/starts a server, never prints
# file contents that could hold credentials (configs are listed by name only),
# and keeps every section bounded.
set -u
BRANCH="${INVENTORY_BRANCH:-main}"
RAW="https://raw.githubusercontent.com/casama233/kaleidoscope-grilling-unofficial/${BRANCH}/tools/ops/server_inventory.py"
TMP="$(mktemp -d /tmp/kg-inventory.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
sec() { printf '\n===== %s =====\n' "$*"; }

sec "host"
hostname; date -Is; uname -sr; id -un
df -h / /srv 2>/dev/null | sort -u
free -h 2>/dev/null | head -2
command -v python3 >/dev/null && python3 --version

sec "bsm roots"
ROOTS=()
for d in /srv/bsm /opt/bsm /root/bsm /home/*/bsm /opt/bedrock-server-manager /srv/bedrock-server-manager; do
  [ -d "$d" ] && ROOTS+=("$d") && echo "$d"
done
for d in "${ROOTS[@]}"; do ls -1 "$d" 2>/dev/null | sed "s|^|  $d/|"; done

sec "bedrock servers (dirs holding worlds/*/level.dat)"
SERVERS=()
while IFS= read -r lvl; do
  srv="$(dirname "$(dirname "$(dirname "$lvl")")")"
  case " ${SERVERS[*]-} " in *" $srv "*) ;; *) SERVERS+=("$srv");; esac
done < <(find / -xdev -path /proc -prune -o -path '*/worlds/*/level.dat' -print 2>/dev/null | head -50)
for s in "${SERVERS[@]-}"; do
  [ -n "$s" ] || continue
  lvl="$(grep -E '^level-name=' "$s/server.properties" 2>/dev/null | cut -d= -f2-)"
  port="$(grep -E '^server-port=' "$s/server.properties" 2>/dev/null | cut -d= -f2-)"
  ver="$(ls "$s" 2>/dev/null | grep -iE 'version|bedrock_server' | head -3 | tr '\n' ' ')"
  echo "$s  level-name=$lvl  port=$port  [$ver]"
  ls -1 "$s/worlds" 2>/dev/null | sed 's/^/    world: /'
done

sec "running bedrock processes"
ps -eo pid,etime,rss,args 2>/dev/null | grep -iE 'bedrock_server|bsm' | grep -v grep | cut -c1-200

sec "pack stack inventory per server"
if curl -fsSL "$RAW" -o "$TMP/inv.py" 2>/dev/null; then
  for s in "${SERVERS[@]-}"; do
    [ -n "$s" ] || continue
    echo "--- $s"
    python3 "$TMP/inv.py" --server-root "$s" 2>&1 | head -4000
  done
else
  echo "could not download server_inventory.py from $RAW"
fi

sec "source checkouts (git) under /srv /opt /root /home"
find /srv /opt /root /home -maxdepth 4 -name .git -type d 2>/dev/null | head -40 | while read -r g; do
  r="$(dirname "$g")"
  url="$(git -C "$r" config --get remote.origin.url 2>/dev/null | sed -E 's#://[^/@]+@#://***@#')"
  head="$(git -C "$r" log -1 --format='%h %cI %s' 2>/dev/null | cut -c1-120)"
  br="$(git -C "$r" rev-parse --abbrev-ref HEAD 2>/dev/null)"
  dirty="$(git -C "$r" status --porcelain 2>/dev/null | wc -l)"
  echo "$r | $url | $br | $head | dirty=$dirty"
done

sec "family / addon_quality tooling (names only)"
for d in /srv/bsm/plugins/addon_quality /srv/family-releases /srv/family-tools-venv /srv/backups /srv/src; do
  [ -e "$d" ] && { echo "$d:"; ls -1t "$d" 2>/dev/null | head -25 | sed 's/^/  /'; }
done
ls -la /srv/AGENTS.md /srv/family-maintenance.json /srv/family-maintenance.lock 2>/dev/null

sec "backups (newest first, names and sizes only)"
find / -xdev -path /proc -prune -o \( -iname '*luosen*' -o -iname '*backup*' \) \( -name '*.zip' -o -name '*.tar*' -o -name '*.mcworld' \) -printf '%TY-%Tm-%Td %s %p\n' 2>/dev/null | sort -r | head -20

sec "content log errors (last 60 matching lines per server)"
for s in "${SERVERS[@]-}"; do
  [ -n "$s" ] || continue
  for f in $(ls -1t "$s"/logs/*.txt "$s"/logs/*.log "$s"/*.log 2>/dev/null | head -3); do
    echo "--- $f"
    grep -aiE 'error|exception|failed|unknown|invalid' "$f" 2>/dev/null | tail -60 | cut -c1-300
  done
done

sec "done"
