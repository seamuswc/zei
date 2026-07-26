#!/usr/bin/env bash
# Daily SQLite backup for ZEI (data/zei.db).
# Install on the droplet (example):
#   sudo mkdir -p /var/backups/zei
#   sudo cp scripts/backup-db.sh /usr/local/bin/zei-backup-db.sh
#   sudo chmod +x /usr/local/bin/zei-backup-db.sh
#   sudo crontab -e
#   15 3 * * * ZEI_DB=/var/www/zei/data/zei.db ZEI_BACKUP_DIR=/var/backups/zei /usr/local/bin/zei-backup-db.sh

set -euo pipefail

DB_PATH="${ZEI_DB:-/var/www/zei/data/zei.db}"
BACKUP_DIR="${ZEI_BACKUP_DIR:-/var/backups/zei}"
KEEP_DAYS="${ZEI_BACKUP_KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB_PATH" ]]; then
  echo "zei-backup: database not found: $DB_PATH" >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dest="$BACKUP_DIR/zei-${stamp}.db"

# Prefer SQLite online backup when sqlite3 CLI is available
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$dest'"
else
  cp -a "$DB_PATH" "$dest"
  # Copy WAL/SHM if present (best-effort when not using .backup)
  [[ -f "${DB_PATH}-wal" ]] && cp -a "${DB_PATH}-wal" "${dest}-wal" || true
  [[ -f "${DB_PATH}-shm" ]] && cp -a "${DB_PATH}-shm" "${dest}-shm" || true
fi

# Prune old backups
find "$BACKUP_DIR" -type f -name 'zei-*.db' -mtime "+${KEEP_DAYS}" -delete 2>/dev/null || true

echo "zei-backup: wrote $dest"
