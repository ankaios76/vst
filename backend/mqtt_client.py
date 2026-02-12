"""
MQTT Publisher for Home Assistant integration.
Publishes call events, extension status, and trunk status.
Gracefully disabled when MQTT_BROKER is not configured.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Try to import paho-mqtt; if not installed, MQTT is disabled
try:
    import paho.mqtt.client as mqtt
    PAHO_AVAILABLE = True
except ImportError:
    PAHO_AVAILABLE = False
    logger.info("paho-mqtt not installed — MQTT publishing disabled")


class MQTTPublisher:
    def __init__(self):
        self.broker = os.getenv("MQTT_BROKER", "")
        self.port = int(os.getenv("MQTT_PORT", "1883"))
        self.username = os.getenv("MQTT_USER", "")
        self.password = os.getenv("MQTT_PASSWORD", "")
        self.client: Optional[Any] = None
        self.connected = False
        self.enabled = bool(self.broker) and PAHO_AVAILABLE

        if not self.enabled:
            if not self.broker:
                logger.info("MQTT_BROKER not set — MQTT publishing disabled")
            return

    def connect(self):
        """Connect to the MQTT broker (blocking call)."""
        if not self.enabled:
            return

        try:
            self.client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id="gonopbx",
            )

            if self.username:
                self.client.username_pw_set(self.username, self.password)

            # Last Will: mark offline if we disconnect unexpectedly
            self.client.will_set("gonopbx/status", "offline", qos=1, retain=True)

            self.client.on_connect = self._on_connect
            self.client.on_disconnect = self._on_disconnect

            logger.info(f"Connecting to MQTT broker {self.broker}:{self.port}...")
            self.client.connect(self.broker, self.port, keepalive=60)
            self.client.loop_start()
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            self.connected = False

    def disconnect(self):
        """Gracefully disconnect from MQTT broker."""
        if not self.client:
            return

        try:
            # Publish offline status before disconnecting
            self.client.publish("gonopbx/status", "offline", qos=1, retain=True)
            self.client.loop_stop()
            self.client.disconnect()
        except Exception as e:
            logger.error(f"Error disconnecting from MQTT: {e}")
        finally:
            self.connected = False

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.connected = True
            logger.info("Connected to MQTT broker")
            # Birth message
            client.publish("gonopbx/status", "online", qos=1, retain=True)
        else:
            logger.error(f"MQTT connection failed with code {rc}")

    def _on_disconnect(self, client, userdata, flags, rc, properties=None):
        self.connected = False
        if rc != 0:
            logger.warning(f"Unexpected MQTT disconnect (rc={rc}), will auto-reconnect")

    def publish(self, topic: str, payload: Any, retain: bool = False):
        """Publish a message. payload can be str or dict (auto-serialized to JSON)."""
        if not self.enabled or not self.connected or not self.client:
            return

        if isinstance(payload, dict):
            payload = json.dumps(payload, default=str)

        try:
            self.client.publish(topic, payload, qos=1, retain=retain)
        except Exception as e:
            logger.error(f"MQTT publish error on {topic}: {e}")

    # --- Convenience methods for GonoPBX events ---

    def publish_call_started(self, caller: str, destination: str, direction: str = "internal"):
        self.publish("gonopbx/call/started", {
            "caller": caller,
            "destination": destination,
            "direction": direction,
            "timestamp": datetime.utcnow().isoformat(),
        })

    def publish_call_answered(self, caller: str, destination: str):
        self.publish("gonopbx/call/answered", {
            "caller": caller,
            "destination": destination,
            "timestamp": datetime.utcnow().isoformat(),
        })

    def publish_call_ended(self, caller: str, destination: str, duration: int, disposition: str):
        self.publish("gonopbx/call/ended", {
            "caller": caller,
            "destination": destination,
            "duration": duration,
            "disposition": disposition,
            "timestamp": datetime.utcnow().isoformat(),
        })

    def publish_extension_status(self, extension: str, status: str):
        self.publish(f"gonopbx/extension/{extension}/status", status, retain=True)

    def publish_trunk_status(self, trunk_name: str, status: str):
        self.publish(f"gonopbx/trunk/{trunk_name}/status", status, retain=True)


    def reconfigure(self, broker: str, port: int, user: str, password: str):
        """Disconnect, update settings, and reconnect."""
        self.disconnect()
        self.broker = broker
        self.port = port
        self.username = user
        self.password = password
        self.enabled = bool(self.broker) and PAHO_AVAILABLE
        if self.enabled:
            self.connect()


# Singleton instance
mqtt_publisher = MQTTPublisher()
