import { ScryptedDeviceType, ScryptedInterface } from "@scrypted/sdk";
import {
    getCollection
} from "home-assistant-js-websocket";
import type HomeAssistantPlugin from "./main";
import { HaBaseDevice } from "./types/baseDevice";
import { HaBinarySensor } from "./types/binarySensor";
import { HaButton } from "./types/button";
import { HaClimate } from "./types/climate";
import { HaCover } from "./types/cover";
import { HaLight } from "./types/light";
import { HaLock } from "./types/lock";
import { HaScript } from "./types/script";
import { HaSecuritySystem } from "./types/securitySystem";
import { HaSwitch } from "./types/switch";
import { HaMediaPlayer } from "./types/mediaPlayer";
import { HaInputBoolean } from "./types/inputBoolean";
import { HaInputSelect } from "./types/inputSelect";
import { HaInputText } from "./types/inputText";
import { HaInputNumber } from "./types/inputNumber";

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
    Device = 'haDevice',
    Notify = 'notify',
    MediaPlayer = 'media_player',
    InputBoolean = 'input_boolean',
    InputSelect = 'input_select',
    InputText = 'input_text',
    InputNumber = 'input_number',
}

interface Attributes {
    device_class?: string;
    friendly_name: string;
    unit_of_measurement?: string;
    state_class?: string;
    current_temperature?: number;
    current_position?: number;
    options?: string[]
}

export interface HaDeviceData {
    deviceId: string;
    entityIds: string[];
    area: string;
    name: string;
    manufacturer: string;
    model: string;
}

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
    HaDomain.MediaPlayer,
    HaDomain.InputBoolean,
    HaDomain.InputSelect,
    HaDomain.InputText,
    HaDomain.InputNumber,
];

export const formatEntityIdToDeviceName = (entityId) => {
    let formatted = entityId.replace(/_/g, ' ');
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    return formatted;
};

interface DeviceConstructor {
    new(plugin: HomeAssistantPlugin, nativeId: string, entity: HaEntityData): HaBaseDevice;
}

export interface DomainMetadata {
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
    [HaDomain.InputBoolean]: {
        type: ScryptedDeviceType.Switch,
        interfaces: [ScryptedInterface.OnOff],
        nativeIdPrefix: 'haInputBoolean',
        deviceConstructor: HaInputBoolean
    },
    [HaDomain.InputSelect]: {
        type: ScryptedDeviceType.Sensor,
        interfaces: [ScryptedInterface.Sensors, ScryptedInterface.Settings],
        nativeIdPrefix: 'haInputSensor',
        deviceConstructor: HaInputSelect
    },
    [HaDomain.InputText]: {
        type: ScryptedDeviceType.Sensor,
        interfaces: [ScryptedInterface.Sensors, ScryptedInterface.Settings],
        nativeIdPrefix: 'haInputText',
        deviceConstructor: HaInputText
    },
    [HaDomain.InputNumber]: {
        type: ScryptedDeviceType.Sensor,
        interfaces: [ScryptedInterface.Sensors, ScryptedInterface.Settings],
        nativeIdPrefix: 'haInputNumber',
        deviceConstructor: HaInputNumber
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
    [HaDomain.MediaPlayer]: {
        type: ScryptedDeviceType.Display,
        interfaces: [
            ScryptedInterface.MediaPlayer,
            ScryptedInterface.OnOff,
            ScryptedInterface.AudioVolumeControl,
            ScryptedInterface.Pause
        ],
        nativeIdPrefix: 'haMediaPlayer',
        deviceConstructor: HaMediaPlayer
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
    [HaDomain.Notify]: undefined,
};

export const getSensorType = (entity: HaEntityData) => {
    const isTemperatureSensor = entity.attributes.device_class === 'temperature' && entity.attributes.state_class === 'measurement';
    const isHumiditySensor = entity.attributes.device_class === 'humidity' && entity.attributes.state_class === 'measurement';

    const isSupported = isTemperatureSensor || isHumiditySensor;

    return { isTemperatureSensor, isHumiditySensor, isSupported };
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

export const getBinarySensorType = (entity: HaEntityData) => {
    const isFLoodSensor = entity.attributes.device_class === 'moisture';
    const isDoorSensor = ['door', 'opening', 'garage', 'garage_door']
        .includes(entity.attributes?.device_class || '')

    return { isFLoodSensor, isDoorSensor };
}

export const mapBinarySensorEntity = (entity: HaEntityData): DomainMetadata => {
    const { isFLoodSensor, isDoorSensor } = getBinarySensorType(entity);

    let domainMetadata: DomainMetadata;
    if (isFLoodSensor) {
        domainMetadata = {
            type: ScryptedDeviceType.Sensor,
            interfaces: [ScryptedInterface.FloodSensor, ScryptedInterface.BinarySensor],
            nativeIdPrefix: 'haBinaryFloodSensor',
            deviceConstructor: HaBinarySensor,
        }
    } else if (isDoorSensor) {
        domainMetadata = {
            type: ScryptedDeviceType.Entry,
            interfaces: [ScryptedInterface.EntrySensor, ScryptedInterface.BinarySensor],
            nativeIdPrefix: 'haBinaryDoorSensor',
            deviceConstructor: HaBinarySensor,
        }
    } else {
        domainMetadata = domainMetadataMap[HaDomain.BinarySensor];
    }

    return domainMetadata;
}

export const getDomainMetadata = (entityData: HaEntityData) => {
    const domain = entityData.entity_id.split('.')[0] as HaDomain;
    if (domain === HaDomain.BinarySensor) {
        return mapBinarySensorEntity(entityData);
    } else if (domain === HaDomain.Sensor) {
        const metadata = mapSensorEntity(entityData);
        if (!metadata) {
            console.log(`Entity not supported: ${entityData.entity_id}, ${JSON.stringify(entityData)}`);
        }
        return metadata;
    } else {
        return domainMetadataMap[domain];
    }
}

// TODO: To be removed when PR will be submitted to the HA repository, this was copied from 
// https://github.com/home-assistant/home-assistant-js-websocket/blob/master/lib/entities.ts#L47
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

export interface DevicesQueryResultItem {
    area: string;
    id: string;
    name: string;
    model: string;
    manufacturer: string;
    entities: string[];
}

export const buildDevicesTemplate = (entityIds: string[]) => {
    return `{% set entities = ${JSON.stringify(entityIds)} %}
       {% set result = namespace(items=[]) %}
        
        {% for entity_id in entities %}
          {% set entity = states(entity_id) %}
          
            {% set device_id = device_id(entity_id) %}
            
            {% if device_id %}
              {% set item = {
                'entity_id': entity_id,
                'device_id': device_id,
                'device_name': device_attr(device_id, 'name') | default('Unknown'),
                'manufacturer': device_attr(device_id, 'manufacturer') | default('Unknown'),
                'model': device_attr(device_id, 'model') | default('Unknown'),
                'area': area_name(area_id(entity_id)) | default('Unknown')
              } %}
          
          {% set result.items = result.items + [item] %}
                      {% endif %}
        {% endfor %}
               {% set finalRes = namespace(devices=[]) %}
        {% for device_id, items in result.items|groupby("device_id") %}
        {% set entities = namespace(entities=[]) %}
          {% for entity in items %}
          {% set entities.entities = entities.entities + [entity.entity_id] %}
          {% endfor %}
          {% set device = {
                'entities': entities.entities,
                'id': device_id,
                'name': device_attr(device_id, 'name') | default('Unknown'),
                'manufacturer': device_attr(device_id, 'manufacturer') | default('Unknown'),
                'model': device_attr(device_id, 'model') | default('Unknown'),
                'area': area_name(area_id(device_id)) | default('Unknown')
              } %}
         {% set finalRes.devices = finalRes.devices + [device] %}
        {% endfor %}
        {{finalRes.devices|tojson}}`;
};