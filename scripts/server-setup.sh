#!/usr/bin/env bash
#
# One-time server bootstrap for the Chess Analysis Server (Ubuntu/Debian).
# Run it ONCE on the server, as the user you will deploy as, via sudo:
#
#     sudo bash scripts/server-setup.sh
#
# Optional overrides (env vars):
#     DOMAIN=chess.example.com sudo -E bash scripts/server-setup.sh   # also configures nginx
#     APP_DIR=/srv/chess  APP_USER=deploy  sudo -E bash scripts/server-setup.sh
#
# After this runs once, ongoing deploys are handled by the GitHub Actions
# workflow (.github/workflows/deploy.yml) on every push to main.
set -euo pipefail

# The user CI will SSH/deploy as AND the systemd service will run as.
# Defaults to whoever invoked sudo (i.e. your normal login user).
APP_USER="${APP_USER:-${SUDO_USER:-$(whoami)}}"
APP_DIR="${APP_DIR:-/opt/chess-analysis}"
DOMAIN="${DOMAIN:-}"                                   # empty => skip nginx
STOCKFISH_PATH="${STOCKFISH_PATH:-/usr/games/stockfish}"
SERVICE=chess-analysis

if [[ $EUID -ne 0 ]]; then echo "Please run with sudo."; exit 1; fi

echo "==> Deploy user : $APP_USER"
echo "==> App dir     : $APP_DIR"
echo "==> Stockfish   : $STOCKFISH_PATH"

echo "==> Installing system packages"
apt-get update
apt-get install -y python3 python3-venv python3-pip stockfish rsync curl

echo "==> Creating app directory (owned by $APP_USER)"
mkdir -p "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "==> Writing systemd service: /etc/systemd/system/$SERVICE.service"
cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=Chess Analysis Server
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment="STOCKFISH_PATH=$STOCKFISH_PATH"
Environment="ENGINE_THREADS=2"
Environment="ENGINE_POOL_SIZE=2"
ExecStart=$APP_DIR/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE"

echo "==> Allowing $APP_USER to restart the service without a password (for CI)"
cat > "/etc/sudoers.d/$SERVICE" <<SUDO
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart $SERVICE, /bin/systemctl restart $SERVICE
SUDO
chmod 440 "/etc/sudoers.d/$SERVICE"

if [[ -n "$DOMAIN" ]]; then
  echo "==> Configuring nginx for $DOMAIN"
  apt-get install -y nginx
  cat > /etc/nginx/sites-available/$SERVICE <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 4m;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # /analyze/stream sends NDJSON live — don't buffer it, and allow long runs.
        proxy_buffering off;
        proxy_read_timeout 600s;
    }
}
NGINX
  ln -sf /etc/nginx/sites-available/$SERVICE /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  echo "==> For HTTPS: sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d $DOMAIN"
fi

echo
echo "==> Server is ready. Next: push to GitHub (or run the workflow) to deploy the code."
echo "    The service will start once the first deploy installs the app + venv."
