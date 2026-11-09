#!/usr/bin/env bash
# Deploy backend SMITH ERP ke server kantor (Falmaco) dan VPS (Fengsheng).
#
# Kode sampai ke server lewat Syncthing, jadi skrip ini TIDAK menyalin kode. Skrip ini:
#   1. memeriksa laptop bersih dan sudah di-push,
#   2. menunggu server memakai commit yang sama (Syncthing),
#   3. menjalankan migrasi database,
#   4. restart smith-backend,
#   5. memastikan /api/health sehat dan versi migrasi = versi terbaru di kode.
# Berhenti di server pertama yang gagal, jadi server berikutnya tidak tersentuh.
#
# Pemakaian:  scripts/deploy.sh [--only vps|office] [--dry-run] [--no-wait] [--force]
#   --only     deploy ke satu server saja
#   --dry-run  hanya periksa dan tampilkan rencana, tidak mengubah apa pun
#   --no-wait  jangan menunggu Syncthing (gagal kalau server belum sinkron)
#   --force    lanjut walau ada perubahan lokal yang belum di-commit (tidak disarankan)
set -euo pipefail

SSH_KEY="${SMITH_VPS_KEY:-$HOME/.ssh/id_ed25519_smithvps}"
# nama|user@host|opsi-ssh  (urutan = urutan deploy; VPS dulu sebagai percobaan)
TARGETS=(
  "vps|bayu@100.121.209.92|-i $SSH_KEY"
  "office|superadmin@100.91.124.96|"
)
REMOTE_DIR="SourceCode"
PM2_NAME="smith-backend"
SYNC_TIMEOUT=180

ONLY=""; DRY=0; WAIT=1; FORCE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) ONLY="${2:-}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --no-wait) WAIT=0; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n 2,19p "$0"; exit 0 ;;
    *) echo "Argumen tidak dikenal: $1"; exit 2 ;;
  esac
done

red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }
ylw() { printf '\033[33m%s\033[0m\n' "$*"; }

cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

echo "== Pemeriksaan lokal"
git fetch -q origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[[ "$LOCAL" == "$REMOTE" ]] || { red "HEAD lokal ($LOCAL) belum sama dengan origin/main ($REMOTE). Push atau pull dulu."; exit 1; }
DIRTY=$(git status --porcelain --untracked-files=no | grep -v -E '(\.stignore|package-lock\.json)$' || true)
if [[ -n "$DIRTY" ]]; then
  if [[ $FORCE -eq 1 ]]; then ylw "Ada perubahan lokal yang belum di-commit (diabaikan karena --force):"; echo "$DIRTY"
  else red "Ada perubahan lokal yang belum di-commit. Commit dulu atau pakai --force:"; echo "$DIRTY"; exit 1; fi
fi
echo "Commit: ${LOCAL:0:7}"

deploy_one() {
  local name="$1" dest="$2" opts="$3"
  # shellcheck disable=SC2086
  local ssh=(ssh -o ConnectTimeout=10 -o BatchMode=yes $opts "$dest")
  echo; echo "== [$name] $dest"
  "${ssh[@]}" true 2>/dev/null || { red "[$name] tidak bisa SSH (server mati atau Tailscale putus)."; return 1; }

  local waited=0 remote_head
  while true; do
    remote_head=$("${ssh[@]}" "git -C ~/$REMOTE_DIR rev-parse HEAD")
    [[ "$remote_head" == "$LOCAL" ]] && break
    if [[ $WAIT -eq 0 || $waited -ge $SYNC_TIMEOUT ]]; then
      red "[$name] server masih di ${remote_head:0:7}, belum sinkron ke ${LOCAL:0:7} (Syncthing)."; return 1
    fi
    ylw "[$name] menunggu Syncthing... (server ${remote_head:0:7}, target ${LOCAL:0:7})"; sleep 10; waited=$((waited+10))
  done
  grn "[$name] kode sinkron di ${LOCAL:0:7}"

  local cur heads
  cur=$("${ssh[@]}" "cd ~/$REMOTE_DIR/backend && . venv/bin/activate && FLASK_APP=app.py flask db current 2>&1 | grep -E '^[0-9a-z_]{8,}' | tail -1")
  heads=$("${ssh[@]}" "cd ~/$REMOTE_DIR/backend && . venv/bin/activate && FLASK_APP=app.py flask db heads 2>&1 | grep -E '^[0-9a-z_]{8,}' | tail -1")
  echo "[$name] migrasi sekarang: ${cur:-?}   | target (heads): ${heads:-?}"

  if [[ $DRY -eq 1 ]]; then ylw "[$name] --dry-run: berhenti di sini."; return 0; fi

  local out
  out=$("${ssh[@]}" "set -o pipefail; cd ~/$REMOTE_DIR/backend && . venv/bin/activate && FLASK_APP=app.py flask db upgrade 2>&1 | tail -3") || { red "[$name] migrasi GAGAL:"; echo "$out"; return 1; }
  "${ssh[@]}" "pm2 restart $PM2_NAME >/dev/null"

  local i status=""
  for i in $(seq 1 20); do
    sleep 3
    status=$("${ssh[@]}" "curl -s -m 5 localhost:5000/api/health | python3 -c 'import sys,json;print(json.load(sys.stdin).get(\"status\",\"\"))' 2>/dev/null" || true)
    [[ "$status" == "healthy" ]] && break
  done
  [[ "$status" == "healthy" ]] || { red "[$name] backend TIDAK sehat setelah restart. Cek: pm2 logs $PM2_NAME"; return 1; }

  local after
  after=$("${ssh[@]}" "cd ~/$REMOTE_DIR/backend && . venv/bin/activate && FLASK_APP=app.py flask db current 2>&1 | grep -E '^[0-9a-z_]{8,}' | tail -1")
  if [[ "$after" != *"(head)"* ]]; then red "[$name] database belum di versi terbaru: $after"; return 1; fi

  local chg
  chg=$("${ssh[@]}" "cd ~/$REMOTE_DIR && git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E 'backend/requirements.txt|frontend/package.json' || true")
  [[ -z "$chg" ]] || ylw "[$name] requirements.txt / package.json berubah di commit terakhir. Periksa apakah perlu pip install / npm install di server."

  grn "[$name] selesai: backend sehat, migrasi ${after%% *} (head), commit ${LOCAL:0:7}"
}

FAILED=0
for t in "${TARGETS[@]}"; do
  IFS='|' read -r name dest opts <<<"$t"
  [[ -z "$ONLY" || "$ONLY" == "$name" ]] || continue
  if ! deploy_one "$name" "$dest" "$opts"; then FAILED=1; red "Berhenti: server berikutnya tidak disentuh."; break; fi
done
echo
[[ $FAILED -eq 0 ]] && grn "Deploy selesai." || { red "Deploy gagal."; exit 1; }
