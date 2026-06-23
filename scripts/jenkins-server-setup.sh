#!/usr/bin/env bash
#
# One-time server setup for the Jenkins deployment on tomiarb.com (venv-based).
# Run ONCE as root (Jenkins handles every deploy after this):
#
#     sudo bash scripts/jenkins-server-setup.sh
#
# Override if your layout differs:
#     JENKINS_USER=jenkins  APP_DIR=/opt/chess-analysis  sudo -E bash scripts/jenkins-server-setup.sh
set -euo pipefail

JENKINS_USER="${JENKINS_USER:-jenkins}"
APP_DIR="${APP_DIR:-/opt/chess-analysis}"
STOCKFISH_PATH="${STOCKFISH_PATH:-/usr/games/stockfish}"
SERVICE=chess-analysis

[[ $EUID -eq 0 ]] || { echo "Please run with sudo."; exit 1; }
id "$JENKINS_USER" &>/dev/null || { echo "ERROR: user '$JENKINS_USER' does not exist."; exit 1; }

echo "==> Installing Python, Stockfish, rsync"
apt-get update
apt-get install -y python3 python3-venv python3-pip stockfish rsync curl

echo "==> Creating jenkins-owned app directory: $APP_DIR"
mkdir -p "$APP_DIR" "$APP_DIR/data"
chown -R "$JENKINS_USER":"$JENKINS_USER" "$APP_DIR"

echo "==> Writing systemd unit: /etc/systemd/system/$SERVICE.service"
cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=Chess Analysis Server
After=network.target

[Service]
Type=simple
User=$JENKINS_USER
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

echo "==> Allowing $JENKINS_USER to restart the service without a password"
cat > "/etc/sudoers.d/$SERVICE" <<SUDO
$JENKINS_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart $SERVICE, /bin/systemctl restart $SERVICE
SUDO
chmod 440 "/etc/sudoers.d/$SERVICE"

echo
echo "==> Server prepared. The service is enabled but won't start until the first"
echo "    Jenkins build creates $APP_DIR/.venv and deploys the code."
echo
echo "    Node for the build comes from the Jenkins NodeJS tool (no system Node needed)."
