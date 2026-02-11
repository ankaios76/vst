FROM andrius/asterisk:20

USER root
RUN apt-get update && apt-get install -y msmtp msmtp-mta ca-certificates tzdata asterisk-prompt-de && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/share/asterisk/sounds/de /var/lib/asterisk/sounds/de
ENV TZ=Europe/Berlin

# Copy pre-downloaded Asterisk core sounds (English)
COPY sounds/en/ /var/lib/asterisk/sounds/en/

# Copy Music on Hold files
COPY moh/ /var/lib/asterisk/moh/
COPY musiconhold.conf /etc/asterisk/musiconhold.conf

# Copy HTML voicemail email sender script
COPY voicemail-sender.sh /usr/local/bin/voicemail-sender.sh
RUN chmod +x /usr/local/bin/voicemail-sender.sh
