#!/bin/sh
# GonoPBX HTML Voicemail Email Sender
# Called by Asterisk via mailcmd= in voicemail.conf
# Reads a standard email from stdin (with attachment), replaces body with HTML

LOGFILE=/var/log/asterisk/voicemail-sender.log
exec 2>>"$LOGFILE"
echo "$(date): voicemail-sender.sh called" >> "$LOGFILE"

# Read the entire email from stdin into a temp file
TMPMAIL=$(mktemp /tmp/vmmail.XXXXXX)
cat > "$TMPMAIL"
echo "$(date): Input saved to $TMPMAIL ($(wc -c < "$TMPMAIL") bytes)" >> "$LOGFILE"

# Extract headers and parts
TO=$(grep -m1 "^To:" "$TMPMAIL" | sed 's/^To: *//')
FROM_ADDR=$(grep -m1 "^From:" "$TMPMAIL" | sed 's/^From: *//' | grep -o '[^ <]*@[^ >]*')
FROM="\"GonoPBX\" <${FROM_ADDR}>"
SUBJECT=$(grep -m1 "^Subject:" "$TMPMAIL" | sed 's/^Subject: *//')
MSGID=$(grep -m1 "^Message-ID:" "$TMPMAIL" | sed 's/^Message-ID: *//')
BOUNDARY="gonopbx-$(date +%s)-$$"

# Extract VM variables from the plain text body
BODY_TEXT=$(sed -n '/^$/,/^--/p' "$TMPMAIL" | head -30)
VM_CALLERID=$(echo "$BODY_TEXT" | grep -o "Von:.*" | head -1 | sed 's/Von: *//')
VM_DUR=$(echo "$BODY_TEXT" | grep -o "Dauer:.*" | head -1 | sed 's/Dauer: *//')
VM_MAILBOX=$(echo "$BODY_TEXT" | grep -o "Mailbox:.*" | head -1 | sed 's/Mailbox: *//')
VM_NAME=$(echo "$SUBJECT" | sed 's/.*von //' | sed 's/ (Dauer.*//')

# Generate German date/time format (dd.mm.yyyy HH:MM Uhr)
VM_DATE=$(TZ=Europe/Berlin date "+%d.%m.%Y %H:%M Uhr")

# Extract attachment if present
HAS_ATTACHMENT=0
ATTACH_FILE=""
ATTACH_NAME=""
ATTACH_TYPE=""

# Check if there's a wav attachment
if grep -q "Content-Type: audio/" "$TMPMAIL"; then
    HAS_ATTACHMENT=1
    ATTACH_TYPE=$(grep "Content-Type: audio/" "$TMPMAIL" | head -1 | sed 's/.*: //' | sed 's/;.*//')
    ATTACH_NAME=$(grep -A1 "Content-Type: audio/" "$TMPMAIL" | grep "name=" | sed 's/.*name="//' | sed 's/".*//' | head -1)
    if [ -z "$ATTACH_NAME" ]; then
        ATTACH_NAME="voicemail.wav"
    fi
    # Extract base64 encoded attachment
    ATTACH_FILE=$(mktemp /tmp/vmattach.XXXXXX)
    sed -n '/Content-Transfer-Encoding: base64/,/^--/{/Content-Transfer-Encoding/d;/^--/d;p}' "$TMPMAIL" > "$ATTACH_FILE"
fi

# Build HTML email
{
cat <<HEADERS
From: $FROM
To: $TO
Subject: $SUBJECT
Message-ID: $MSGID
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="$BOUNDARY"

--$BOUNDARY
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: 8bit

HEADERS

cat <<'HTMLSTART'
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f1f3f5;font-family:'Inter',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f3f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.06);overflow:hidden;">

<!-- Header with Logo -->
<tr><td style="padding:28px 32px 12px;text-align:center;">
<img src="https://gonopbx.de/logo.png" alt="GonoPBX" width="220" style="display:inline-block;max-width:220px;height:auto;">
<div style="font-size:13px;color:#9ca3af;margin-top:8px;">Voicemail Benachrichtigung</div>
</td></tr>

<!-- Icon -->
<tr><td style="padding:28px 32px 0;text-align:center;">
<div style="display:inline-block;width:56px;height:56px;background:#e0f2fe;border-radius:50%;line-height:56px;font-size:26px;">&#9993;</div>
</td></tr>

<!-- Title -->
<tr><td style="padding:16px 32px 0;text-align:center;">
<div style="font-size:18px;font-weight:600;color:#111827;">Neue Sprachnachricht</div>
</td></tr>

<!-- Details Card -->
<tr><td style="padding:20px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:12px;border:1px solid #e5e7eb;">

<tr>
<td style="padding:14px 20px 10px;border-bottom:1px solid #e5e7eb;">
<div style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Anrufer</div>
HTMLSTART

printf '<div style="font-size:15px;font-weight:600;color:#111827;margin-top:2px;">%s</div>\n' "$VM_CALLERID"

cat <<'HTMLMID1'
</td>
</tr>

<tr>
<td style="padding:14px 20px 10px;border-bottom:1px solid #e5e7eb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="50%" style="vertical-align:top;">
<div style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Datum</div>
HTMLMID1

printf '<div style="font-size:14px;color:#4b5563;margin-top:2px;">%s</div>\n' "$VM_DATE"

cat <<'HTMLMID2'
</td>
<td width="50%" style="vertical-align:top;">
<div style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Dauer</div>
HTMLMID2

printf '<div style="font-size:14px;color:#4b5563;margin-top:2px;">%s</div>\n' "$VM_DUR"

cat <<'HTMLMID3'
</td>
</tr></table>
</td>
</tr>

<tr>
<td style="padding:14px 20px 14px;">
<div style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Mailbox</div>
HTMLMID3

printf '<div style="font-size:14px;color:#4b5563;margin-top:2px;">%s</div>\n' "$VM_MAILBOX"

cat <<'HTMLMID4'
</td>
</tr>

</table>
</td></tr>

<!-- Attachment hint -->
<tr><td style="padding:0 32px 24px;text-align:center;">
<div style="display:inline-block;background:#dcfce7;color:#16a34a;font-size:13px;font-weight:500;padding:8px 16px;border-radius:8px;">&#127908; Sprachnachricht als Anhang beigef&uuml;gt</div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
<div style="font-size:12px;color:#9ca3af;">Automatisch gesendet von Ihrer GonoPBX Telefonanlage</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
HTMLMID4

# Add attachment if present
if [ "$HAS_ATTACHMENT" = "1" ] && [ -s "$ATTACH_FILE" ]; then
    printf "\n--%s\n" "$BOUNDARY"
    printf "Content-Type: %s; name=\"%s\"\n" "$ATTACH_TYPE" "$ATTACH_NAME"
    printf "Content-Transfer-Encoding: base64\n"
    printf "Content-Disposition: attachment; filename=\"%s\"\n\n" "$ATTACH_NAME"
    cat "$ATTACH_FILE"
    printf "\n"
fi

printf "\n--%s--\n" "$BOUNDARY"

} | /usr/bin/msmtp -t 2>>"$LOGFILE"
RESULT=$?
echo "$(date): msmtp exit code: $RESULT" >> "$LOGFILE"

# Cleanup
rm -f "$TMPMAIL" "$ATTACH_FILE"
