import { ScryptedDeviceType, ScryptedInterface } from "@scrypted/sdk";

export const supportedDomains = [
    'binary_sensor',
    'lock',
    'alarm_control_panel',
];

export const formatEntityIdToDeviceName = (entityId) => {
    // Sostituisci gli underscore con spazi
    let formatted = entityId.replace(/_/g, ' ');

    // Capitalizza la prima lettera
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    return formatted;
};

interface DiscoveryData {
    nativeIdPrefix: string;
    type: ScryptedDeviceType;
    interfaces: ScryptedInterface[];
}

export const domainToDiscoveryDataMap: Record<string, DiscoveryData> = {
    'binary_sensor': {
        type: ScryptedDeviceType.Sensor,
        interfaces: [ScryptedInterface.BinarySensor],
        nativeIdPrefix: 'haBinarySensor'
    },
    'lock': {
        type: ScryptedDeviceType.Lock,
        interfaces: [ScryptedInterface.Lock],
        nativeIdPrefix: 'haLock'
    },
    'alarm_control_panel': {
        type: ScryptedDeviceType.SecuritySystem,
        interfaces: [ScryptedInterface.SecuritySystem],
        nativeIdPrefix: 'haSecuritySystem'
    },
} 