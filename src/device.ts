import { DeviceProvider, ScryptedDeviceBase } from "@scrypted/sdk";
import HomeAssistantPlugin from "./main";
import { domainMetadataMap, HaDomain } from "./utils";

export class HaDevice extends ScryptedDeviceBase implements DeviceProvider {
    constructor(public plugin: HomeAssistantPlugin, nativeId: string) {
        super(nativeId);
    }

    async getDevice(nativeId: string): Promise<any> {
        const [_, entityId] = nativeId.split(':');
        const [domain] = entityId.split('.') as [HaDomain];

        const DeviceConstructor = domainMetadataMap[domain]?.deviceConstructor;
        if (DeviceConstructor) {
            return new DeviceConstructor(this.plugin, nativeId, entityId);
        }
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
    }
}
