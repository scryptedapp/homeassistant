import { ScryptedDeviceType, ScryptedInterface } from "@scrypted/sdk";
import type HomeAssistantPlugin from "./main";
import { HaBaseDevice } from "./types/baseDevice";
import { HaBinarySensor } from "./types/binarySensor";
import { HaLock } from "./types/lock";
import { HaSwitch } from "./types/switch";
import { HaLight } from "./types/light";
import { HaSecuritySystem } from "./types/securitySystem";
import { HaButton } from "./types/button";
import { HaScript } from "./types/script";
import { HaCover } from "./types/cover";
import { HaClimate } from "./types/climate";

export enum HaDomain {
    BinarySensor = 'binary_sensor',
    Lock = 'lock',
    Switch = 'switch',
    Light = 'light',
    AlarmControlPanel = 'alarm_control_panel',
    Button = 'button',
    Script = 'script',
    Cover = 'cover',
    Climate = 'climate',
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
    HaDomain.Button,
    HaDomain.Script,
    HaDomain.Climate,
    HaDomain.Cover,
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
    type: ScryptedDeviceType | string;
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
    [HaDomain.Button]: {
        type: 'Button',
        interfaces: [ScryptedInterface.Buttons],
        nativeIdPrefix: 'haButton',
        deviceConstructor: HaButton
    },
    [HaDomain.Script]: {
        type: ScryptedDeviceType.Program,
        interfaces: [ScryptedInterface.Program],
        nativeIdPrefix: 'haScript',
        deviceConstructor: HaScript
    },
    [HaDomain.Cover]: {
        type: ScryptedDeviceType.WindowCovering,
        interfaces: [ScryptedInterface.Entry],
        nativeIdPrefix: 'haCover',
        deviceConstructor: HaCover
    },
    [HaDomain.Climate]: {
        type: ScryptedDeviceType.Thermostat,
        interfaces: [
            ScryptedInterface.Thermometer,
            ScryptedInterface.TemperatureSetting,
            ScryptedInterface.OnOff,
        ],
        nativeIdPrefix: 'haClimate',
        deviceConstructor: HaClimate
    },
}; 