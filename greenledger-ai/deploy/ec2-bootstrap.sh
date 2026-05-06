#!/bin/bash
# GreenLedger AI — EC2 bootstrap (Ubuntu 22.04 LTS, t3.medium recommended)
# Run once on a fresh EC2 instance as the `ubuntu` user.
#
#   curl -O https://raw.githubusercontent.com/<your-fork>/main/greenledger-ai/deploy/ec2-bootstrap.sh
#   chmod +x ec2-bootstrap.sh
#   ./ec2-bootstrap.sh
set -euo pipefail

log() { echo -e "\n\033[1;36m═══ $* ═══\033[0m"; }

log "1/6 System updates"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

log "2/6 Node.js 20 LTS via NodeSource"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm  --version

log "3/6 Python 3.11 (deadsnakes PPA)"
sudo apt-get install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt-get update -y
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip
python3.11 --version

log "4/6 System libraries (PDF, fonts, build tools, redis-cli)"
sudo apt-get install -y \
  poppler-utils \
  libgl1 libglib2.0-0 \
  build-essential git curl unzip \
  redis-tools

log "5/6 PM2 (process manager)"
sudo npm install -g pm2
echo ""
echo "→ Run this command (printed by pm2 startup) ONCE to enable auto-start on reboot:"
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1

log "6/6 AWS CLI v2"
if ! command -v aws &> /dev/null; then
  curl -sS "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
  unzip -q awscliv2.zip
  sudo ./aws/install
  rm -rf aws awscliv2.zip
fi
aws --version

echo ""
echo -e "\033[1;32m✓ Bootstrap complete.\033[0m"
echo ""
echo "Next steps:"
echo "  1. git clone <your-repo> ~/GreenLedger-Main"
echo "  2. cd ~/GreenLedger-Main/greenledger-ai/backend && npm ci --omit=dev && nano .env"
echo "  3. cd ../ai-engine && python3.11 -m venv venv && source venv/bin/activate \\"
echo "       && pip install -r requirements.txt && deactivate && nano .env"
echo "  4. cd .. && pm2 start ecosystem.config.js && pm2 save"
echo "  5. ./deploy/healthcheck.sh"
