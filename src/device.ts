import { DeviceProvider, ScryptedDeviceBase } from "@scrypted/sdk";
import type HomeAssistantPlugin from "./main";
import { getDomainMetadata } from "./utils";
import { HaSensors } from "./types/sensors";

export class HaDevice extends ScryptedDeviceBase implements DeviceProvider {
    constructor(public plugin: HomeAssistantPlugin, nativeId: string) {
        super(nativeId);
    }

    getDeviceInternal(nativeId: string) {
        try {
            const entityId = nativeId.split(':')[1];
            const entityData = this.plugin.entitiesMap[entityId];

            let device;

            if (this.plugin.deviceMap[entityId]) {
                device = this.plugin.deviceMap[entityId];
            } else {
                if (entityData) {
                    const DeviceConstructor = getDomainMetadata(entityData)?.deviceConstructor;

                    if (DeviceConstructor) {
                        device = new DeviceConstructor(this.plugin, nativeId, entityData);
                    }
                } else {
                    const deviceData = this.plugin.devicesMap[entityId];

                    if (deviceData) {
                        const { entityIds } = deviceData;
                        const entities = entityIds.map(innerEntityId => this.plugin.entitiesMap[innerEntityId])
                            .filter(entity => !!entity);
                        device = new HaSensors(this.plugin, nativeId, entities);
                    }
                }
            }

            if (device) {
                this.plugin.deviceMap[entityId] = device;

                device.refreshConfiguration();
                return device;
            }
        } catch (e) {
            this.console.log('Error in device getDeviceInternal', e);
        }
    }

    async getDevice(nativeId: string): Promise<any> {
        try {
            return this.getDeviceInternal(nativeId);
        } catch (e) {
            this.console.log('Error in device getDevice', e);
        }
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
    }
}
