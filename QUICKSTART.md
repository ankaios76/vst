# VstPBX Schnellstart

Vollständige Anleitung: [docs/INSTALLATION.de.md](docs/INSTALLATION.de.md) (Deutsch), [docs/INSTALLATION.md](docs/INSTALLATION.md) (English).

```bash
# Docker und Compose-Plugin müssen installiert sein (https://get.docker.com)
sudo git clone https://github.com/ankaios76/vstpbx.git /opt/vstpbx
cd /opt/vstpbx
sudo ./install.sh
```

Danach im Browser `http://<server-ip>:3000` öffnen und als `admin` anmelden. Das Passwort steht in `/opt/vstpbx/.env` (`ADMIN_PASSWORD`).

Erste Schritte: Nebenstelle anlegen, Telefon anmelden, Leitung zum Provider einrichten, eingehende Rufnummer zuweisen. Die Anleitung beschreibt jeden Schritt.
