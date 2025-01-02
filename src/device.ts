import { BinarySensor, DeviceProvider, ScryptedDeviceBase, SecuritySystem, SecuritySystemMode, Lock } from "@scrypted/sdk";
import HomeAssistantPlugin from "./main";

export class BinarySensorDevice extends ScryptedDeviceBase implements BinarySensor {
    constructor(public plugin: HomeAssistantPlugin, nativeId: string, entityId: string) {
        super(nativeId);

        this.plugin.deviceMap[entityId] = this;
    }
}

export class LockDevice extends ScryptedDeviceBase implements Lock {
    constructor(public plugin: HomeAssistantPlugin, nativeId: string, entityId: string) {
        super(nativeId);

        this.plugin.deviceMap[entityId] = this;
    }

    lock(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    unlock(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

export class SecuritySystemDevice extends ScryptedDeviceBase implements SecuritySystem {
    constructor(public plugin: HomeAssistantPlugin, nativeId: string, entityId: string) {
        super(nativeId);

        this.plugin.deviceMap[entityId] = this;
    }

    armSecuritySystem(mode: SecuritySystemMode): Promise<void> {
        throw new Error("Method not implemented.");
    }
    disarmSecuritySystem(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

export class HaDevice extends ScryptedDeviceBase implements DeviceProvider {
    constructor(public plugin: HomeAssistantPlugin, nativeId: string) {
        super(nativeId);
    }

    async getDevice(nativeId: string): Promise<any> {
        const [_, entityId] = nativeId.split(':');
        const [domain] = entityId.split('.');

        if (domain === 'binary_sensor') {
            return new BinarySensorDevice(this.plugin, nativeId, entityId);
        }

        if (domain === 'lock') {
            return new LockDevice(this.plugin, nativeId, entityId);
        }

        if (domain === 'alarm_control_panel') {
            return new SecuritySystemDevice(this.plugin, nativeId, entityId);
        }
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
    }
}
