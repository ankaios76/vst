#!/bin/bash
set -e

echo "============================================"
echo "  GonoPBX Installer"
echo "============================================"
echo ""

# Check if user can run Docker (root or docker group)
if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Cannot connect to Docker."
    echo "       Run as root or add your user to the docker group:"
    echo "       sudo usermod -aG docker \$USER"
    exit 1
fi

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker is not installed."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose is not available."; exit 1; }

echo "[OK] Docker and Docker Compose found."
echo ""

# --- Check for existing installation ---
FRESH_INSTALL=true

if [ -f .env ]; then
    echo "Bestehende Installation gefunden."
    echo ""
    echo "  [1] Update - Code aktualisieren, Daten und Passwoerter behalten"
    echo "  [2] Neu    - Alles loeschen und komplett neu installieren"
    echo ""
    read -rp "Auswahl [1]: " INSTALL_MODE

    if [ "$INSTALL_MODE" = "2" ]; then
        echo ""
        echo "ACHTUNG: Alle Daten (Nebenstellen, Trunks, Anrufverlauf) werden geloescht!"
        read -rp "Wirklich alles loeschen? [j/N]: " CONFIRM_DELETE
        if [ "$CONFIRM_DELETE" = "j" ] || [ "$CONFIRM_DELETE" = "J" ]; then
            echo "Stoppe Container und loesche Daten..."
            docker compose down -v 2>/dev/null || true
            rm -f .env asterisk/config/manager.conf
            echo "[OK] Alte Installation entfernt"
            FRESH_INSTALL=true
        else
            echo "Abgebrochen."
            exit 0
        fi
    else
        # --- Update mode ---
        echo ""
        echo "Aktualisiere GonoPBX..."

        # Source existing env values
        # shellcheck disable=SC1091
        . ./.env

        # Regenerate manager.conf with existing AMI password
        sed "s/%%AMI_PASSWORD%%/${AMI_PASSWORD}/" asterisk/config/manager.conf.template > asterisk/config/manager.conf
        echo "[OK] manager.conf updated"

        echo ""
        echo "Starte Container neu..."
        docker compose up -d --build

        # Detect local LAN IP
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")

        echo ""
        echo "============================================"
        echo "  GonoPBX Update Complete!"
        echo "============================================"
        echo ""
        if [ "$BIND_ADDRESS" = "0.0.0.0" ] && [ -n "$LOCAL_IP" ]; then
            echo "  Web GUI:    http://${LOCAL_IP}:3000"
        else
            echo "  Web GUI:    http://localhost:3000"
        fi
        echo ""
        echo "  Zugangsdaten unveraendert (siehe .env)"
        echo "============================================"
        exit 0
    fi
fi

# --- Fresh installation ---

# Detect external IP
echo "Detecting external IP address..."
DETECTED_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null || echo "")

if [ -n "$DETECTED_IP" ]; then
    echo "Detected external IP: $DETECTED_IP"
    read -rp "Use this IP? [Y/n]: " USE_DETECTED
    if [ "$USE_DETECTED" = "n" ] || [ "$USE_DETECTED" = "N" ]; then
        read -rp "Enter external IP: " EXTERNAL_IP
    else
        EXTERNAL_IP="$DETECTED_IP"
    fi
else
    echo "Could not detect external IP automatically."
    read -rp "Enter external IP: " EXTERNAL_IP
fi

# Detect local LAN IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")

echo ""

# Network mode
echo "Nutzt du einen Reverse Proxy (z.B. Nginx) vor GonoPBX?"
echo "  [1] Nein  - Direkter Zugriff aus dem Netzwerk (empfohlen fuer Heimnetz)"
echo "  [2] Ja    - Zugriff nur ueber localhost/Reverse Proxy"
read -rp "Auswahl [1]: " PROXY_CHOICE
if [ "$PROXY_CHOICE" = "2" ]; then
    BIND_ADDRESS="127.0.0.1"
    echo "-> Bind: 127.0.0.1 (nur localhost)"
else
    BIND_ADDRESS="0.0.0.0"
    echo "-> Bind: 0.0.0.0 (Zugriff aus dem Netzwerk)"
fi

# SIP port
echo ""
echo "SIP-Port fuer Asterisk (Standard: 5060)"
echo "Aendern falls dein Router ein SIP-ALG hat (z.B. FritzBox)"
read -rp "SIP-Port [5060]: " SIP_PORT
SIP_PORT="${SIP_PORT:-5060}"
echo "-> SIP-Port: $SIP_PORT"

echo ""

# Admin password
printf "Set admin password (leave empty to auto-generate): "
IFS= read -r ADMIN_PASSWORD
if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
    printf 'Generated admin password: %s\n' "$ADMIN_PASSWORD"
else
    printf 'Password set: %s\n' "$ADMIN_PASSWORD"
fi

# Generate secure random passwords
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=')
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
AMI_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')

# Home Assistant integration (optional)
echo ""
echo "Home Assistant Integration (optional)"
read -rp "Generate API key for Home Assistant? [y/N]: " HA_CHOICE
if [ "$HA_CHOICE" = "y" ] || [ "$HA_CHOICE" = "Y" ]; then
    HA_API_KEY=$(openssl rand -hex 32)
    printf 'Generated HA API Key: %s\n' "$HA_API_KEY"
    echo ""
    read -rp "MQTT broker address (leave empty to skip): " MQTT_BROKER
    if [ -n "$MQTT_BROKER" ]; then
        read -rp "MQTT port [1883]: " MQTT_PORT
        MQTT_PORT="${MQTT_PORT:-1883}"
        read -rp "MQTT user (leave empty if none): " MQTT_USER
        if [ -n "$MQTT_USER" ]; then
            printf "MQTT password: "
            IFS= read -r MQTT_PASSWORD
        fi
    fi
else
    HA_API_KEY=""
    MQTT_BROKER=""
fi

echo ""
echo "Generating configuration..."

# Create .env file
cat > .env <<'ENVEOF'
# GonoPBX Configuration - generated by install.sh
ENVEOF
# Write values without quotes (Docker Compose v2 treats quotes as literal)
{
    printf 'EXTERNAL_IP=%s\n' "$EXTERNAL_IP"
    printf 'ADMIN_PASSWORD=%s\n' "$ADMIN_PASSWORD"
    printf 'JWT_SECRET=%s\n' "$JWT_SECRET"
    printf 'DB_PASSWORD=%s\n' "$DB_PASSWORD"
    printf 'AMI_PASSWORD=%s\n' "$AMI_PASSWORD"
    printf 'BIND_ADDRESS=%s\n' "$BIND_ADDRESS"
    printf 'SIP_PORT=%s\n' "$SIP_PORT"
    printf 'PROJECT_DIR=%s\n' "$(pwd)"
    printf 'HA_API_KEY=%s\n' "${HA_API_KEY:-}"
    printf 'MQTT_BROKER=%s\n' "${MQTT_BROKER:-}"
    printf 'MQTT_PORT=%s\n' "${MQTT_PORT:-1883}"
    printf 'MQTT_USER=%s\n' "${MQTT_USER:-}"
    printf 'MQTT_PASSWORD=%s\n' "${MQTT_PASSWORD:-}"
} >> .env

echo "[OK] .env created"

# Write manager.conf from template with generated AMI password
sed "s/%%AMI_PASSWORD%%/${AMI_PASSWORD}/" asterisk/config/manager.conf.template > asterisk/config/manager.conf

echo "[OK] manager.conf updated"

# Start containers
echo ""
echo "Starting containers..."
docker compose up -d --build

# Send anonymous install telemetry (non-blocking, no personal data)
INSTALL_OS=$(. /etc/os-release 2>/dev/null && echo "$ID $VERSION_ID" || echo "unknown")
INSTALL_ARCH=$(uname -m)
INSTALL_VERSION=$(grep '^VERSION' backend/version.py 2>/dev/null | cut -d'"' -f2 || echo "unknown")
curl -s -o /dev/null --max-time 5 \
  -X POST "https://analytics.gonopbx.de/api/send" \
  -H "Content-Type: application/json" \
  -H "User-Agent: GonoPBX-Installer/${INSTALL_VERSION}" \
  -d "{\"payload\":{\"hostname\":\"gonopbx.de\",\"url\":\"/install\",\"website\":\"cc8fa162-1aef-4c89-8e13-4fdbfa9bc6f7\",\"name\":\"install\",\"data\":{\"os\":\"${INSTALL_OS}\",\"arch\":\"${INSTALL_ARCH}\",\"version\":\"${INSTALL_VERSION}\"}}}" \
  2>/dev/null || true

echo ""
echo "============================================"
echo "  GonoPBX Installation Complete!"
echo "============================================"
echo ""
if [ "$BIND_ADDRESS" = "0.0.0.0" ]; then
    ACCESS_IP="${LOCAL_IP:-$EXTERNAL_IP}"
    echo "  Web GUI:    http://${ACCESS_IP}:3000"
    echo "  API:        http://${ACCESS_IP}:8000"
    if [ -n "$LOCAL_IP" ] && [ "$LOCAL_IP" != "$EXTERNAL_IP" ]; then
        echo ""
        echo "  Lokales Netzwerk: http://${LOCAL_IP}:3000"
        echo "  Extern:           http://${EXTERNAL_IP}:3000"
        echo "                     (Port 3000 muss im Router freigegeben sein)"
    fi
else
    echo "  Web GUI:    http://localhost:3000"
    echo "  API:        http://localhost:8000"
    echo "  (Reverse Proxy noetig fuer externen Zugriff)"
fi
echo ""
printf '  Login:      admin / %s\n' "$ADMIN_PASSWORD"
echo ""
echo "  Credentials are saved in .env"
echo "============================================"
