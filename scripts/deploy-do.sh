#!/usr/bin/env bash
# DigitalOcean deployment: the Bun server behind Caddy, HTTPS on flash.patforna.com.
# Usage: scripts/deploy-do.sh up     run the gate, create the droplet if needed, provision, sync, check, print the link
#        scripts/deploy-do.sh cards  ship cards/cards.toml alone (checked and fit-tested), restart, check; never code
#        scripts/deploy-do.sh link   print the link
#        scripts/deploy-do.sh logs   tail the service log
#        scripts/deploy-do.sh down   destroy the droplet and its A record
# Needs: doctl (authenticated), rsync, bun, what `bun run verify` needs (README), and an SSH key registered on DO
# (SSH_KEY = its DO id).
set -euo pipefail

NAME=flash
REGION=fra1
SIZE=s-1vcpu-512mb-10gb
IMAGE=ubuntu-24-04-x64
SSH_KEY=${SSH_KEY:-0}
APP=/opt/flash
# patforna.com's DNS is on DigitalOcean; ~/github/system README, "Web apps".
DOMAIN=flash.patforna.com

root=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$root/var"
SSH="ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$root/var/known_hosts -o ConnectTimeout=5"

ip() { doctl compute droplet list "$NAME" --format PublicIPv4 --no-header; }
remote() { $SSH "root@$(ip)" "$@"; }
# $DOMAIN's A record. up points it at the droplet, so a recreated droplet keeps its link; down removes it, so a
# released IP can't serve the name for whoever gets it next.
record() { doctl compute domain records list patforna.com --format ID,Type,Name --no-header | awk -v n="${DOMAIN%%.*}" '$2 == "A" && $3 == n { print $1 }'; }
dns() {
  local id
  id=$(record)
  if [[ -n $id ]]; then
    doctl compute domain records update patforna.com --record-id "$id" --record-data "$(ip)" >/dev/null
  else
    doctl compute domain records create patforna.com --record-type A --record-name "${DOMAIN%%.*}" --record-data "$(ip)" --record-ttl 300 >/dev/null
  fi
}
link() { echo "https://$DOMAIN/"; }

# The droplet's app directory, staged here so that one rsync --delete makes the droplet match it: the bundled server
# (every dependency inside, so no node_modules), the built client and the deck.
stage() {
  local out=$root/build/release
  rm -rf "$out"
  mkdir -p "$out/cards"
  cp "$root/build/server.js" "$out/"
  cp -R "$root/dist" "$out/"
  cp "$root/cards/cards.toml" "$out/cards/"
}

# First on the droplet, where a server that won't start shows its log; then from here, through DNS, Caddy and TLS,
# where /healthz must report the deck just shipped. Retried for up to 2 minutes: a new droplet waits for its DNS
# record and its certificate; a running one answers at once.
health() {
  local want got deadline=$((SECONDS + 120))
  remote "for _ in \$(seq 15); do curl -fs 127.0.0.1:3000/healthz >/dev/null && exit; sleep 1; done; exit 1" ||
    { remote "journalctl -u flash -n 30 --no-pager"; exit 1; }
  want=$(cd "$root" && bun scripts/check-cards.ts --version cards/cards.toml)
  until got=$(curl -fs --max-time 10 "https://$DOMAIN/healthz" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p') && [[ $got == "$want" ]]; do
    if ((SECONDS >= deadline)); then
      echo "https://$DOMAIN/healthz reports ${got:-no version}, not $want" >&2
      exit 1
    fi
    sleep 5
  done
}

up() {
  # The gate: nothing reaches the droplet unless every check passes. No flag skips it. CI=1 makes Playwright start its
  # own servers, so a stale one left on 4173 or 4174 fails the gate instead of being tested.
  (cd "$root" && bun install --frozen-lockfile && CI=1 bun run verify)
  stage

  if [[ -z $(ip) ]]; then
    doctl compute droplet create "$NAME" --image "$IMAGE" --size "$SIZE" --region "$REGION" \
      --ssh-keys "$SSH_KEY" --tag-name web-app --enable-monitoring --wait >/dev/null
    rm -f "$root/var/known_hosts"
  fi
  until remote true 2>/dev/null; do sleep 3; done
  dns

  remote "APP=$APP DOMAIN=$DOMAIN BUN_VERSION=$(bun --version) bash -s" <<'EOF'
set -euo pipefail
cloud-init status --wait >/dev/null || true
export DEBIAN_FRONTEND=noninteractive
apt() { apt-get -o DPkg::Lock::Timeout=300 "$@"; }
# Caddy's own repo: Ubuntu 24.04 ships Caddy 2.6, from 2022.
if [[ ! -f /etc/apt/sources.list.d/caddy-stable.list ]]; then
  apt update -q                       # fresh droplet images ship stale package lists
  apt install -yq debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt update -q
fi
apt install -yq -o Dpkg::Options::=--force-confold caddy rsync unzip
# Bun pinned to the laptop's version, so the droplet runs what the gate tested.
[[ $(/usr/local/bin/bun --version 2>/dev/null) == "$BUN_VERSION" ]] ||
  curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash -s "bun-v$BUN_VERSION" >/dev/null
id app &>/dev/null || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin app
mkdir -p "$APP/app"

cat > /etc/systemd/system/flash.service <<UNIT
[Unit]
Description=flash
After=network.target

[Service]
User=app
WorkingDirectory=$APP/app
Environment=HOST=127.0.0.1 PORT=3000 CARDS=$APP/app/cards/cards.toml DIST=$APP/app/dist
ExecStart=/usr/local/bin/bun server.js
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

# HTTPS on $DOMAIN; plain HTTP redirects to it. One directive per line: Caddy cannot parse a block on one line.
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
EOF

  rsync -az --delete -e "$SSH" "$root/build/release/" "root@$(ip):$APP/app/"
  remote "chown -R app: $APP/app && systemctl daemon-reload && systemctl enable -q flash && systemctl restart flash && systemctl reload caddy"
  health
  link
}

# The deck alone, never code: checked, fit-tested against the app as built here, then the one file and a restart.
cards() {
  [[ -n $(ip) ]] || { echo "no droplet named $NAME: run up first" >&2; exit 1; }
  (cd "$root" && bun run cards:check)
  # The fit test runs the built server: build only when there is none, so shipping cards never rebuilds the code.
  [[ -d $root/dist && -f $root/build/server.js ]] || (cd "$root" && bun run build)
  (cd "$root" && CI=1 bun run e2e tests/e2e/fit.spec.ts)
  rsync -az -e "$SSH" "$root/cards/cards.toml" "root@$(ip):$APP/app/cards/"
  remote "chown app: $APP/app/cards/cards.toml && systemctl restart flash"
  health
  link
}

logs() { remote "journalctl -u flash -n 100 --no-pager"; }

down() {
  if [[ -n $(ip) ]]; then doctl compute droplet delete "$NAME" --force; else echo "no droplet named $NAME"; fi
  local id; id=$(record)
  [[ -z $id ]] || doctl compute domain records delete patforna.com "$id" --force
  rm -f "$root/var/known_hosts"
}

case ${1:-} in
  up | cards | link | logs | down) "$1" ;;
  *) sed -n '2,7p' "$0"; exit 1 ;;
esac
