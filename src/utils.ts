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
import {
    getCollection
} from "home-assistant-js-websocket";

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
    Sensor = 'sensor',
    Device = 'device',
}

interface Attributes {
    device_class?: string;
    friendly_name: string;
    unit_of_measurement?: string;
    state_class?: string;
    current_temperature?: number;
    current_position?: number;
}

export interface HaDeviceData {
    deviceId: string;
    entityIds: string[];
    name: string;
}

export const deviceNativeIdPrefix = 'haDevice';

export interface HaEntityData<TState extends string = string> {
    entity_id: string;
    state?: TState;
    attributes: Attributes
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
    HaDomain.Sensor,
];

export const formatEntityIdToDeviceName = (entityId) => {
    let formatted = entityId.replace(/_/g, ' ');
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    return formatted;
};

interface DeviceConstructor {
    new(plugin: HomeAssistantPlugin, nativeId: string, entity: HaEntityData): HaBaseDevice;
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
        interfaces: [ScryptedInterface.PressButtons],
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
        interfaces: [ScryptedInterface.Entry, ScryptedInterface.Settings, ScryptedInterface.EntrySensor],
        nativeIdPrefix: 'haCover',
        deviceConstructor: HaCover
    },
    [HaDomain.Climate]: {
        type: ScryptedDeviceType.Thermostat,
        interfaces: [
            ScryptedInterface.Thermometer,
            ScryptedInterface.TemperatureSetting,
            ScryptedInterface.OnOff,
            ScryptedInterface.Settings,
        ],
        nativeIdPrefix: 'haClimate',
        deviceConstructor: HaClimate
    },
    [HaDomain.Device]: undefined,
    [HaDomain.Sensor]: undefined,
};

export const getSensorType = (entity: HaEntityData) => {
    const isSensor = entity.entity_id.startsWith('sensor.');
    const isTemperatureSensor = isSensor && entity.attributes.device_class === 'temperature' && entity.attributes.state_class === 'measurement';
    const isHumiditySensor = isSensor && entity.attributes.device_class === 'humidity' && entity.attributes.state_class === 'measurement';

    return { isSensor, isTemperatureSensor, isHumiditySensor }
}

export const mapSensorEntity = (entity: HaEntityData): DomainMetadata => {
    const { isHumiditySensor, isTemperatureSensor } = getSensorType(entity);

    let domainMetadata: DomainMetadata;
    if (isTemperatureSensor) {
        domainMetadata = {
            type: ScryptedDeviceType.Thermostat,
            interfaces: [ScryptedInterface.Thermometer],
            nativeIdPrefix: 'haClimate',
            deviceConstructor: HaClimate,
        }
    } else if (isHumiditySensor) {
        domainMetadata = {
            type: ScryptedDeviceType.Thermostat,
            interfaces: [ScryptedInterface.HumiditySensor],
            nativeIdPrefix: 'haClimate',
            deviceConstructor: HaClimate,
        }
    }

    if (domainMetadata && !entity.attributes.unit_of_measurement) {
        domainMetadata.interfaces.push(ScryptedInterface.Settings);
    }

    return domainMetadata;
}

const doorSensorDeviceClasses = ['door', 'opening', 'garage', 'garage_door'];
export function isDoorSensor(entity: HaEntityData): boolean {
    return doorSensorDeviceClasses.includes(entity.attributes?.device_class || '');
}

export const getDomainMetadata = (entityData: HaEntityData) => {
    const domain = entityData.entity_id.split('.')[0] as HaDomain;
    if (domain === HaDomain.BinarySensor) {
        if (isDoorSensor(entityData)) {
            return {
                type: ScryptedDeviceType.Entry,
                interfaces: [ScryptedInterface.EntrySensor],
                nativeIdPrefix: 'haBinaryDoorSensor',
                deviceConstructor: HaBinarySensor,
            };
        }
        return domainMetadataMap[HaDomain.BinarySensor];
    }
    if (domain === HaDomain.Sensor) {
        const metadata = mapSensorEntity(entityData);
        if (!metadata) {
            console.log(`Entity not supported: ${entityData.entity_id}, ${JSON.stringify(entityData)}`);
        }
        return metadata;
    } else {
        return domainMetadataMap[domain];
    }
}

function processEvent(store, updates) {
    const state = Object.assign({}, store.state);
    if (updates.a) {
        for (const entityId in updates.a) {
            const newState = updates.a[entityId];
            let last_changed = new Date(newState.lc * 1000).toISOString();
            state[entityId] = {
                entity_id: entityId,
                state: newState.s,
                attributes: newState.a,
                context: typeof newState.c === "string"
                    ? { id: newState.c, parent_id: null, user_id: null }
                    : newState.c,
                last_changed: last_changed,
                last_updated: newState.lu
                    ? new Date(newState.lu * 1000).toISOString()
                    : last_changed,
            };
        }
    }
    if (updates.r) {
        for (const entityId of updates.r) {
            delete state[entityId];
        }
    }
    if (updates.c) {
        for (const entityId in updates.c) {
            let entityState = state[entityId];
            if (!entityState) {
                console.warn("Received state update for unknown entity", entityId);
                continue;
            }
            entityState = Object.assign({}, entityState);
            const { "+": toAdd, "-": toRemove } = updates.c[entityId];
            const attributesChanged = (toAdd === null || toAdd === void 0 ? void 0 : toAdd.a) || (toRemove === null || toRemove === void 0 ? void 0 : toRemove.a);
            const attributes = attributesChanged
                ? Object.assign({}, entityState.attributes) : entityState.attributes;
            if (toAdd) {
                if (toAdd.s !== undefined) {
                    entityState.state = toAdd.s;
                }
                if (toAdd.c) {
                    if (typeof toAdd.c === "string") {
                        entityState.context = Object.assign(Object.assign({}, entityState.context), { id: toAdd.c });
                    }
                    else {
                        entityState.context = Object.assign(Object.assign({}, entityState.context), toAdd.c);
                    }
                }
                if (toAdd.lc) {
                    entityState.last_updated = entityState.last_changed = new Date(toAdd.lc * 1000).toISOString();
                }
                else if (toAdd.lu) {
                    entityState.last_updated = new Date(toAdd.lu * 1000).toISOString();
                }
                if (toAdd.a) {
                    Object.assign(attributes, toAdd.a);
                }
            }
            if (toRemove === null || toRemove === void 0 ? void 0 : toRemove.a) {
                for (const key of toRemove.a) {
                    delete attributes[key];
                }
            }
            if (attributesChanged) {
                entityState.attributes = attributes;
            }
            state[entityId] = entityState;
        }
    }
    store.setState(state, true);
}

// TODO: This to submit as PR to the HA repository
// https://github.com/home-assistant/home-assistant-js-websocket/issues/271
export const subscribeEntities = (conn: any, entityIds: string[], onChange: (entities: Record<string, HaEntityData>) => Promise<void>) => getCollection(
    conn,
    "_ent",
    undefined,
    (conn, store) => conn.subscribeMessage((ev) => processEvent(store, ev), {
        type: "subscribe_entities",
        entity_ids: entityIds,
    })
).subscribe(onChange);