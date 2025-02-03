import { DeviceProvider, ScryptedDeviceBase } from "@scrypted/sdk";
import type HomeAssistantPlugin from "./main";
import { getDomainMetadata } from "./utils";
import { HaBaseDevice } from "./types/baseDevice";

export class HaDevice extends ScryptedDeviceBase implements DeviceProvider {
    constructor(public plugin: HomeAssistantPlugin, nativeId: string) {
        super(nativeId);
    }

    async getDevice(nativeId: string): Promise<any> {
        try {
            const entityId = nativeId.split(':')[1];
            const entityData = this.plugin.entitiesMap[entityId];

            if (this.plugin.deviceMap[entityId]) {
                return this.plugin.deviceMap[entityId];
            }

            if (entityData) {
                const DeviceConstructor = getDomainMetadata(entityData)?.deviceConstructor;

                if (DeviceConstructor) {
                    const device = new DeviceConstructor(this.plugin, nativeId, entityData);
                    this.plugin.deviceMap[entityId] = device;

                    return device;
                }
            }
        } catch (e) {
            this.console.log('Error in device getDevice', e);
        }
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
    }
}
