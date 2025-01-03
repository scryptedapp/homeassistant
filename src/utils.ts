import { ScryptedDeviceType, ScryptedInterface } from "@scrypted/sdk";
import HomeAssistantPlugin from "./main";
import { HaBaseDevice } from "./types/baseDevice";
import { HaBinarySensor } from "./types/binarySensor";
import { HaLock } from "./types/lock";
import { HaSwitch } from "./types/switch";
import { HaLight } from "./types/light";
import { HaSecuritySystem } from "./types/securitySystem";

export enum HaDomain {
    BinarySensor = 'binary_sensor',
    Lock = 'lock',
    Switch = 'switch',
    Light = 'light',
    AlarmControlPanel = 'alarm_control_panel',
}

export interface HaEntityData<TState extends string = string> {
    entity_id: string;
    state: TState;
    attributes: any;
}

export const supportedDomains: HaDomain[] = [
    HaDomain.BinarySensor,
    HaDomain.Lock,
    HaDomain.AlarmControlPanel,
    HaDomain.Light,
    HaDomain.Switch,
];

export const formatEntityIdToDeviceName = (entityId) => {
    let formatted = entityId.replace(/_/g, ' ');
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    return formatted;
};

interface DeviceConstructor {
    new(plugin: HomeAssistantPlugin, nativeId: string, entityId: string): HaBaseDevice;
}

interface DomainMetadata {
    nativeIdPrefix: string;
    type: ScryptedDeviceType;
    interfaces: ScryptedInterface[];
    deviceConstructor: DeviceConstructor;
}

export const domainMetadataMap: Record<HaDomain, DomainMetadata> = {
    [HaDomain.BinarySensor]: {
        type: ScryptedDeviceType.Sensor,
        interfaces: [ScryptedInterface.BinarySensor],
        nativeIdPrefix: 'haBinarySensor',
        deviceConstructor: HaBinarySensor
    },
    [HaDomain.Lock]: {
        type: ScryptedDeviceType.Lock,
        interfaces: [ScryptedInterface.Lock],
        nativeIdPrefix: 'haLock',
        deviceConstructor: HaLock
    },
    [HaDomain.AlarmControlPanel]: {
        type: ScryptedDeviceType.SecuritySystem,
        interfaces: [ScryptedInterface.SecuritySystem],
        nativeIdPrefix: 'haSecuritySystem',
        deviceConstructor: HaSecuritySystem
    },
    [HaDomain.Switch]: {
        type: ScryptedDeviceType.Switch,
        interfaces: [ScryptedInterface.OnOff],
        nativeIdPrefix: 'haSwitch',
        deviceConstructor: HaSwitch
    },
    [HaDomain.Light]: {
        type: ScryptedDeviceType.Light,
        interfaces: [ScryptedInterface.OnOff],
        nativeIdPrefix: 'haLight',
        deviceConstructor: HaLight
    },
}; 