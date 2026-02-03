#!/bin/bash

# AI Productivity Dashboard - Deployment Script
# Usage: ./deploy.sh

set -e

APP_DIR="/var/www/ai-productivity-dashboard"
REPO_URL="your-git-repo-url"  # Update this

echo "🚀 Deploying AI Productivity Dashboard..."

# 1. Create directory if not exists
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# 2. Copy files (or git pull)
echo "📦 Copying files..."
# If using git:
# cd $APP_DIR && git pull origin main
# Or copy manually:
# rsync -av --exclude='node_modules' --exclude='.env' ./ $APP_DIR/

# 3. Install dependencies
echo "📥 Installing dependencies..."
cd $APP_DIR
npm install --production=false

# 4. Create .env if not exists
if [ ! -f "$APP_DIR/.env" ]; then
    echo "⚠️  Please create .env file with your credentials:"
    echo "   cp .env.example .env && nano .env"
    exit 1
fi

# 5. Build frontend
echo "🔨 Building frontend..."
npm run build

# 6. Setup systemd service
echo "⚙️  Setting up systemd service..."
sudo cp deploy/ai-productivity.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ai-productivity
sudo systemctl restart ai-productivity

# 7. Setup nginx
echo "🌐 Setting up nginx..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ai-productivity.defikit.net
sudo ln -sf /etc/nginx/sites-available/ai-productivity.defikit.net /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 8. Setup SSL (optional)
echo "🔒 Do you want to setup SSL with Let's Encrypt? (y/n)"
read -r setup_ssl
if [ "$setup_ssl" = "y" ]; then
    sudo certbot --nginx -d ai-productivity.defikit.net
fi

echo "✅ Deployment complete!"
echo "🌍 Visit: http://ai-productivity.defikit.net"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status ai-productivity  # Check status"
echo "  sudo systemctl restart ai-productivity # Restart app"
echo "  sudo journalctl -u ai-productivity -f  # View logs"
