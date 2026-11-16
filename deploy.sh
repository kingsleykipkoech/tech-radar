#!/usr/bin/env bash
# ==============================================================================
# Automated Deployment Script for Tech Radar
# ALU Summative Assignment: Playing Around with APIs
# Author: Kingsley Kipkoech
# ==============================================================================
# Target Servers:
#   - web-01: 35.178.212.47
#   - web-02: 18.130.235.76
#   - lb-01:  18.170.99.24 (kingsleykoech.tech)
# ==============================================================================

set -euo pipefail

WEB_01="35.178.212.47"
WEB_02="18.130.235.76"
LB_01="18.170.99.24"
SSH_USER="ubuntu"
SSH_KEY="${1:-$HOME/.ssh/id_rsa}"

if [ ! -f "$SSH_KEY" ]; then
    echo "[ERROR] SSH key not found at $SSH_KEY"
    echo "Usage: ./deploy.sh [PATH_TO_SSH_PRIVATE_KEY]"
    exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -i $SSH_KEY"

deploy_node() {
    local host="$1"
    local name="$2"

    echo "--------------------------------------------------------"
    echo "[DEPLOYING] Target: $name ($host)"
    echo "--------------------------------------------------------"

    # 1. Ensure git & node are installed
    ssh $SSH_OPTS "$SSH_USER@$host" "
        sudo apt-get update -y >/dev/null 2>&1
        command -v node >/dev/null 2>&1 || sudo apt-get install -y nodejs npm >/dev/null 2>&1
    "

    # 2. Sync tech-radar repository
    ssh $SSH_OPTS "$SSH_USER@$host" "
        if [ ! -d ~/tech-radar ]; then
            git clone https://github.com/kingsleykipkoech/tech-radar.git ~/tech-radar
        else
            cd ~/tech-radar && git pull origin main
        fi
    "

    # 3. Create & start systemd service
    ssh $SSH_OPTS "$SSH_USER@$host" "
        sudo tee /etc/systemd/system/techradar.service > /dev/null << 'EOF'
[Unit]
Description=Tech Radar Open Source Intelligence Node ($name)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/tech-radar
ExecStart=/usr/bin/node /home/ubuntu/tech-radar/server.js
Restart=always
RestartSec=5
Environment=PORT=5000
Environment=SERVER_NAME=$name
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
        sudo systemctl daemon-reload
        sudo systemctl enable --now techradar
        sudo systemctl restart techradar
    "

    # 4. Verify local application response
    echo "[VERIFYING] Testing local HTTP endpoint on $name..."
    ssh $SSH_OPTS "$SSH_USER@$host" "curl -s http://localhost:5000/api/health"
    echo ""
    echo "[SUCCESS] $name deployed and healthy!"
}

configure_lb() {
    echo "--------------------------------------------------------"
    echo "[CONFIGURING] Load Balancer lb-01 ($LB_01)"
    echo "--------------------------------------------------------"

    ssh $SSH_OPTS "$SSH_USER@$LB_01" "
        # Ensure HAProxy routes port 5000 backends
        if ! grep -q 'techradar_back' /etc/haproxy/haproxy.cfg; then
            sudo tee -a /etc/haproxy/haproxy.cfg << 'EOF'

frontend techradar_front
    bind *:8080
    mode http
    default_backend techradar_back

backend techradar_back
    mode http
    balance roundrobin
    option httpchk GET /api/health
    http-check expect status 200
    server web-01 35.178.212.47:5000 check inter 2000 rise 2 fall 3
    server web-02 18.130.235.76:5000 check inter 2000 rise 2 fall 3
EOF
            sudo service haproxy reload
        fi
    "
    echo "[SUCCESS] Load Balancer configured!"
}

# Run deployment
deploy_node "$WEB_01" "web-01"
deploy_node "$WEB_02" "web-02"
configure_lb

echo "========================================================"
echo "DEPLOYMENT COMPLETE!"
echo "Check your cluster live: http://$LB_01:8080 or http://kingsleykoech.tech"
echo "========================================================"
