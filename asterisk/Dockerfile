FROM andrius/asterisk:18

USER root
RUN apt-get update && apt-get install -y msmtp msmtp-mta ca-certificates && rm -rf /var/lib/apt/lists/*
