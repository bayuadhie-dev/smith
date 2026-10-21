#!/bin/bash
# Portable - uses the script's own location so this works identically on
# any machine regardless of home directory (2026-10-17: a hardcoded
# /home/<user>/... path here broke production when Syncthing propagated a
# VPS-specific copy of this file back to this server, since the folder is
# synced bidirectionally and this file's absolute paths differ per machine).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/venv/bin/activate"
python "$DIR/app.py"
