#!/bin/bash
# Wrapper start script untuk PM2 - PM2 tidak baca .env otomatis, jadi
# env var di-export manual di sini sebelum exec python. Mirror pola
# backend/start.sh (venv activate + python app.py).
set -a
source "$(dirname "$0")/.env"
set +a
source "$(dirname "$0")/venv/bin/activate"
exec python "$(dirname "$0")/main.py"
