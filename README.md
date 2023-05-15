# Scrypted Home Assistant Plugin

The Home Assistant Plugin for Scrypted imports `notify` services to be used within Scrypted. This plugin is currently only functional if Scrypted was installed as a Home Assistant Addon.

This plugin is primarily intended for usage with Scrypted NVR's notification delivery.

## Scrypted NVR

Scrypted NVR notification clicks will be sent to the Lovelace URL `/lovelace/scrypted-nvr-[camera-id]` where `camera-id` is the numeric `id` (visible in the browser URL) of the camera.

Home Assistant users can create a Lovelace url that contains that camera.

There is currently no way to deep link into Scrypted Addon.
