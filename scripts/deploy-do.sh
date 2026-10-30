#!/usr/bin/env bash
# DigitalOcean deployment: the Bun server behind Caddy, HTTPS on flash.patforna.com.
# Usage: scripts/deploy-do.sh up     run the gate, create the droplet if needed, provision, sync, check, print the link
#        scripts/deploy-do.sh cards  ship cards/cards.toml alone: check and fit-test it, sync it, restart, check
#        scripts/deploy-do.sh link   print the link
#        scripts/deploy-do.sh logs   tail the service log
#        scripts/deploy-do.sh down   destroy the droplet and its A record
# Needs: doctl (authenticated), rsync, bun, and an SSH key registered on DO (SSH_KEY = its DO id).
set -euo pipefail

case ${1:-} in
  up | cards | link | logs | down) "$1" ;;
  *) sed -n '2,7p' "$0"; exit 1 ;;
esac
