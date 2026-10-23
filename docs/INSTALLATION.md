# Installing and setting up VstPBX

This guide takes you from an empty Linux machine to your first phone call through VstPBX. It assumes you have used a terminal before, but not that you know Asterisk. A German version lives in [INSTALLATION.de.md](INSTALLATION.de.md).

**Contents**

1. [What you need](#1-what-you-need)
2. [Prepare the network](#2-prepare-the-network)
3. [Install Docker](#3-install-docker)
4. [Install VstPBX](#4-install-vst)
5. [First login](#5-first-login)
6. [First extension and first phone](#6-first-extension-and-first-phone)
7. [Provider trunk and phone numbers](#7-provider-trunk-and-phone-numbers)
8. [Optional: voicemail, ring groups, IVR, Home Assistant](#8-optional-voicemail-ring-groups-ivr-home-assistant)
9. [Hardening: HTTPS, firewall, Fail2Ban](#9-hardening-https-firewall-fail2ban)
10. [Operations: logs, backup, update](#10-operations-logs-backup-update)
11. [Troubleshooting](#11-troubleshooting)
12. [Uninstall](#12-uninstall)

---

## 1. What you need

| | Minimum | Recommended |
|---|---|---|
| Machine | 2 CPU cores, 2 GB RAM, 10 GB free disk | 4 cores, 4 GB RAM |
| OS | Debian 12 / Ubuntu 22.04 | Debian 13 / Ubuntu 24.04 |
| Software | Docker Engine 24+ with the Compose plugin, `git`, `curl`, `openssl` | |
| Network | a fixed (or reserved) LAN address | |

A Raspberry Pi 4/5 (64-bit), a mini PC, a VM or a rented server all work. The first build of the images takes 5 to 15 minutes depending on the machine.

For real calls you also need a **SIP account** from your phone provider (user name, password, server) and at least one **SIP phone or softphone app**. To just try things out, two softphones are enough: calls between extensions work without a provider.

## 2. Prepare the network

VstPBX runs four containers. These are the ports that matter:

| Port | Protocol | Purpose | Reachable from |
|---|---|---|---|
| 3000 | TCP | web interface | LAN/VPN only, or through an HTTPS proxy |
| 8000 | TCP | API (the web interface uses it internally) | LAN/VPN only |
| 5060 (or your choice) | UDP and TCP | SIP | LAN; the provider only needs outbound access, see below |
| 10000–10100 | UDP | RTP (the audio) | LAN; also from outside if phones connect over the internet |

Three situations come up in practice:

**a) Everything at home or in an office, the provider connects through registration.** The easy case. VstPBX registers with the provider (an outbound connection) and your phones are on the same LAN. You do **not** need to open anything on the router. Give the VstPBX machine a fixed address (DHCP reservation).

**b) Phones outside the network (home office, smartphone on the road).** Best through a VPN such as WireGuard, which makes it case a) again. Without a VPN, forward 5060 and 10000–10100/UDP on the router to the VstPBX machine and read chapter 9 first.

**c) The provider calls VstPBX from outside (IP authentication, no registration).** Port 5060 must be reachable from the provider. Allow only your provider's addresses in the firewall.

**Turn SIP ALG off.** Many routers (FRITZ!Box, Speedport, older TP-Link) have a feature that "fixes" SIP packets and breaks them. Typical symptoms: the phone rings but there is no audio, or calls drop after 30 seconds. If you see this and cannot disable the ALG, choose a SIP port other than 5060 during installation (for example 5062), which usually bypasses it.

**External IP.** The installer asks for the server's public address and suggests the detected one. It ends up in the PJSIP configuration (`external_media_address`) and helps Asterisk write correct addresses into SIP packets. For use inside your LAN this is fine even if the address changes. For connections from the internet use a fixed address or a dynamic DNS name.

## 3. Install Docker

If `docker compose version` already prints a version, skip this step.

On Debian or Ubuntu with the official script:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # then log out and back in once
```

Check:

```bash
docker --version
docker compose version
git --version
```

All three must print a version.

## 4. Install VstPBX

```bash
sudo git clone https://github.com/ankaios76/vstpbx.git /opt/vstpbx
cd /opt/vstpbx
sudo ./install.sh
```

`/opt/vstpbx` is only a suggestion. What matters is that the folder stays where it is: the installer writes it to `.env`, and the update function needs it.

The installer asks:

| Question | Answer |
|---|---|
| **Use this IP?** | Enter if the detected address is right. Otherwise `n` and type your own. |
| **Do you use a reverse proxy?** | `1` = web interface reachable on the whole network (fine for a home network). `2` = reachable only on the server itself, so you need a proxy in front (chapter 9). When in doubt: `2`, and put HTTPS in front. |
| **Language** | `1` German, `2` English. It is fixed when the frontend is built. |
| **SIP port** | Enter for 5060, or another port (see SIP ALG above). |
| **Admin password** | Leave empty to get a random one. It is stored in `.env`. |
| **Home Assistant** | `N` unless you need it. You can add it later in the settings. |

The installer then builds the images and starts the containers. Check with:

```bash
docker compose ps
```

All four containers (`pbx_asterisk`, `pbx_backend`, `pbx_frontend`, `pbx_postgres`) should be `Up`, Asterisk and PostgreSQL also `healthy`.

To read the admin password:

```bash
sudo grep ADMIN_PASSWORD /opt/vstpbx/.env
```

`.env` holds every secret of the installation. Do not share it and never commit it to a repository.

## 5. First login

Open `http://<server-ip>:3000` in a browser (with install mode 2, from the server itself or through your proxy). Log in as `admin` with the password from `.env`.

![Login page](img/login.png)

The dashboard shows the state of VstPBX and Asterisk and the number of registered phones, followed by trunks, extensions and recent calls.

![Dashboard](img/dashboard.png)

Change your password first: click your round avatar at the top right; the "Change password" dialog opens. Note that on every backend start the admin password is set to the value in `.env` again. If you do not want that, put the new password into `.env` too (`ADMIN_PASSWORD=...`) and run `docker restart pbx_backend`.

## 6. First extension and first phone

**Settings → Nebenstellen (Extensions) → Neue Nebenstelle (New extension).** (With the English interface the labels are in English.)

![Extensions](img/extensions.png)

Fill in:

- **Extension:** the internal number, for example `101`
- **Caller ID:** the name shown on internal calls (for example "Reception")
- **Password:** use the **Generate** button. The bar below shows its strength.

Save. VstPBX writes the configuration and reloads Asterisk.

**Set up the phone.** In any SIP phone or softphone (Yealink, Snom, Grandstream, Linphone, Zoiper, a FRITZ!Fon through the FRITZ!Box, …) enter:

| Field in the phone | Value |
|---|---|
| SIP server / registrar | the VstPBX machine's address |
| Port | 5060 (or your chosen port) |
| User name / auth ID | the extension, for example `101` |
| Password | the extension's password |
| Transport | UDP |
| Codecs | G.722, A-law (PCMA), µ-law (PCMU) |

After saving, the extension shows up as registered on the dashboard. Create a second extension, register a second phone and call `102` from `101`. That proves VstPBX and Asterisk work without any provider involved.

The extension's detail view (pencil icon in the list) has five tabs: **Numbers** (inbound numbers and outbound caller ID), **Call forwarding** (always, busy, no answer), **Voicemail**, **Audio codecs** and **Features** (for example BLF and pickup group).

![Extension detail](img/extension-detail.png)

## 7. Provider trunk and phone numbers

**Settings → Leitungen (Trunks) → Neue Leitung (New trunk).**

![Trunks](img/trunks.png)

1. **Choose the provider.** Server and quirks are preconfigured for Plusnet IPfonie, dus.net, Telekom DeutschlandLAN, CompanyFlex, Telekom All-IP (residential, MagentaZuhause) and Iliad Italy. For anything else use the generic entry and type the SIP server yourself.
2. **Credentials** from your provider (user name, password; for Telekom All-IP also the line number as "From user").
3. **Authentication:** registration (VstPBX registers with the provider) or IP authentication (the provider sends from fixed addresses). Your provider's documents say which one applies.
4. **Number block:** if you have several numbers, enter the block, for example `03023125100-03023125199`. A short form works too: the part after the dash replaces the last digits of the first number (`03023125100-99` is the same block). Blocks are limited to 1000 numbers.

Save. The trunk appears on the dashboard with a status dot. Green means registered with the provider.

**Assign an inbound number to an extension.** In the extension's **Numbers** tab pick the number and the trunk. Ring groups and IVR menus get their inbound number in their own form.

**Outbound caller ID.** In the **Numbers** tab choose which of the assigned numbers is shown on outgoing calls. Optionally VstPBX adds a `P-Asserted-Identity` header with the main number of the block, which some providers require for number blocks. For Telekom All-IP VstPBX sets the line number as the sender automatically.

**Test it.** Call your number from a mobile phone: the assigned extension must ring. Then call a mobile number from the extension, dialled with a leading `0` (`0151…`). Both calls appear in the call history shortly after.

![Call history](img/cdr.png)

## 8. Optional: voicemail, ring groups, IVR, Home Assistant

**Voicemail.** Every extension gets a mailbox automatically. Ring time before the mailbox and the PIN are set in the extension's **Voicemail** tab. Dial `*98` from your phone to listen to your own mailbox; `*97` plus an extension (for example `*97101`) opens that extension's mailbox. Prompts are German because the German Asterisk sound pack is part of the image. To receive messages by e-mail too, enter your SMTP server under **Settings → E-Mail** (VstPBX detects port 465 or 587 itself) and send a test message.

**Ring groups.** **Settings → Gruppen (Groups)**: name, internal number, members, strategy (all at once, round robin, least recently used) and ring time. Optionally assign an inbound number.

![Groups](img/groups.png)

**IVR (voice menu).** **Settings → IVR**: upload a prompt (VstPBX converts it to the right format), map keys to destinations, set retries, optionally assign an inbound number.

**Phonebook.** Global and personal contacts, CSV import and export. Stored names appear in the call history.

**Home Assistant.** **Settings → Home Assistant**: generate an API key, enter the MQTT broker, test the connection. VstPBX publishes call events and status over MQTT (topics `gonopbx/...`; the name stayed for compatibility) and offers an endpoint for click-to-call.

## 9. Hardening: HTTPS, firewall, Fail2Ban

Read this chapter before anything is reachable from the internet.

**Put HTTPS in front of the web interface.** Choose "reverse proxy" (mode 2) during installation; ports 3000 and 8000 then listen on `127.0.0.1` only. With Caddy this is enough:

```
vstpbx.example.org {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy fetches the certificate itself. The nginx inside the frontend container forwards `/api` and `/ws` (WebSocket) to the backend, so you only have to pass port 3000. If you do not want the web interface on the internet at all, reach it through a VPN.

**Firewall on the VstPBX machine.** Example with `ufw` for a home network `192.168.1.0/24`:

```bash
sudo ufw default deny incoming
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 5060
sudo ufw allow from 192.168.1.0/24 to any port 10000:10100 proto udp
sudo ufw enable
```

Careful: Docker publishes ports **around `ufw`**. Published container ports stay reachable despite `ufw`. If you bind to `127.0.0.1` during installation (mode 2) and restrict SIP with rules in the `DOCKER-USER` chain or a firewall on your router, you are on the safe side.

**SIP allow-list.** Under **Settings → Sicherheit (Security)** you can restrict which addresses may register phones. For an office LAN this is the most effective single measure.

**Fail2Ban.** If Fail2Ban runs on the host, VstPBX shows active bans and jails under **Security**. A jail for Asterisk bans addresses after failed logins. The Asterisk log is in the project folder under `asterisk/logs/`.

**Strong passwords.** The **Security** tab (allow-list, password check and Fail2Ban status) lists extensions with weak passwords. Give every extension a generated password.

**Docker socket.** The backend container mounts `/var/run/docker.sock`. VstPBX needs it to reload Asterisk after every change (it runs `asterisk -rx reload` inside the Asterisk container) and for the update from the web interface. That is effectively root on the host for anyone who can run code in the backend. So never expose port 8000 to the internet and keep the web interface behind a VPN or an HTTPS proxy. If you remove the mount the interface still starts, but Asterisk no longer picks up changes by itself: you would have to restart the `pbx_asterisk` container after every change.

![Security](img/security.png)

## 10. Operations: logs, backup, update

**Status and logs**

```bash
cd /opt/vstpbx
docker compose ps                 # is everything running?
docker compose logs -f backend    # backend, live
docker compose logs -f asterisk   # Asterisk, live
docker exec -it pbx_asterisk asterisk -rvvv    # Asterisk console
```

In the Asterisk console `pjsip show endpoints` lists the registered phones and `pjsip show registrations` shows whether the trunk is registered.

**Restart:** `docker compose restart`. All containers come back after a server reboot on their own (`restart: unless-stopped`).

**Backup.** You need:

1. the database (extensions, trunks, routes, call history, users),
2. voicemail messages and uploads (Docker volumes),
3. the `.env` file.

A simple script for a daily cron job:

```bash
#!/bin/bash
set -e
cd /opt/vstpbx
DEST=/var/backups/vstpbx/$(date +%F)
mkdir -p "$DEST"
docker exec pbx_postgres pg_dump -U asterisk asterisk_gui | gzip > "$DEST/db.sql.gz"
for v in asterisk_voicemail user_uploads; do
  docker run --rm -v "$(basename "$PWD")_$v":/data -v "$DEST":/out alpine \
    tar czf "/out/$v.tgz" -C /data .
done
cp .env "$DEST/env" && chmod 600 "$DEST/env"
```

Copy the backup folder to a **different** place (another machine, NAS, cloud storage). A backup on the same disk does not protect against a disk failure.

The volumes are called `<folder name>_asterisk_voicemail` and `<folder name>_user_uploads`, so `vst_…` for `/opt/vstpbx`. `docker volume ls` shows the exact names.

**Restore** on a freshly installed VstPBX:

```bash
cd /opt/vstpbx
docker compose stop backend
gunzip -c /path/to/backup/db.sql.gz | docker exec -i pbx_postgres psql -U asterisk -d asterisk_gui
docker compose start backend
```

On start the backend rewrites the Asterisk configuration from the database.

**Update**

Web interface: **Settings → Server → Update**. Command line:

```bash
cd /opt/vstpbx
sudo git pull
sudo ./install.sh        # choose "[1] Update" when asked
```

Update mode keeps data and passwords and rebuilds the containers. Database changes run automatically on start. Take a backup before updating.

## 11. Troubleshooting

**The web interface does not load.** Check `docker compose ps`. Is `pbx_frontend` running? With install mode 2, port 3000 is open on `127.0.0.1` only; use the proxy or an SSH tunnel (`ssh -L 3000:127.0.0.1:3000 user@server`).

**Login fails.** The password is in `.env`. To reset it, change `ADMIN_PASSWORD` there and run `docker restart pbx_backend`.

**A phone does not register.** Check extension, password and server address. **Settings → SIP Debug** shows SIP messages live: does a `REGISTER` arrive? Does VstPBX answer `401` (wrong password) or not at all (network/firewall)? `docker compose logs asterisk` helps too.

**The phone rings but there is no audio, or only one direction.** Almost always NAT or SIP ALG. Check that UDP 10000–10100 is reachable, that the external IP in `.env` is right and that the router's SIP ALG is off (chapter 2).

**A call drops after about 30 seconds.** The ACK does not reach the server, again typical for an ALG or a wrong port forward. Pick another SIP port.

**The trunk never turns green.** Check credentials, server and authentication type. `pjsip show registrations` in the Asterisk console gives the reason (`Rejected`, `Unregistered`, …). Some providers require you to enable the SIP account first.

**Outbound calls are rejected by the provider.** Usually the wrong sender number. Pick an outbound number you own (in the format the provider expects, often without a leading `+`) and check whether the provider requires `P-Asserted-Identity`.

**Voicemail e-mail does not arrive.** Send the test message under **Settings → E-Mail**. The error message names the cause (login, port, TLS).

**Nothing helps.** Look at `docker compose logs --tail 200 backend asterisk` and open an [issue](https://github.com/ankaios76/vstpbx/issues). Redact passwords and public IP addresses first.

## 12. Uninstall

```bash
cd /opt/vstpbx
docker compose down -v      # removes containers AND data (database, voicemail)
cd / && sudo rm -rf /opt/vstpbx
```

Without `-v` the Docker volumes with your data stay.
