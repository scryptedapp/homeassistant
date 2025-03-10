import sdk, { DeviceManifest, DeviceProvider, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface, Setting, Settings, SettingValue } from '@scrypted/sdk';
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import axios from 'axios';
import {
    createConnection,
    createLongLivedTokenAuth,
} from "home-assistant-js-websocket";
import { HaDevice } from './device';
import { httpsAgent } from './httpsagent';
import { NotifyService } from './notify';
import { HaBaseDevice } from './types/baseDevice';
import { deviceNativeIdPrefix, formatEntityIdToDeviceName, getDomainMetadata, HaDeviceData, HaEntityData, subscribeEntities, supportedDomains } from './utils';
import { HaWebsocket } from './websocket';
import { clearWWWDirectory } from './www';
import { sleep } from '../../scrypted/common/src/sleep';

globalThis.WebSocket = HaWebsocket as any;

const notifyPrefix = 'notify';
const devicesPrefix = 'haDevices';
const retryDelay = 10;
const maxRetries = 20;

if (process.env.SUPERVISOR_TOKEN)
    clearWWWDirectory();

class HomeAssistantPlugin extends ScryptedDeviceBase implements DeviceProvider, Settings {
    connection: any;
    deviceMap: Record<string, HaBaseDevice> = {};
    entitiesMap: Record<string, HaEntityData> = {};
    devicesMap: Record<string, HaDeviceData> = {};
    entityNameToIdMap: Record<string, string> = {};
    // Entities can belong to only 1 device
    entityIdDeviceIdMap: Record<string, string> = {};
    notifiersProvider: NotifyService;
    devicesProvider: HaDevice;
    wsUnsubFn: () => void;

    storageSettings = new StorageSettings(this, {
        personalAccessToken: {
            title: 'Personal Access Token',
            description: 'Provide a personal access token for your Home Assistant user. Needed to support navigation back into the Scrypted addon.',
        },
        address: {
            title: 'Address',
            description: 'The host and port of the Home Assistant server. E.g. 192.168.2.100:8123',
            hide: !!process.env.SUPERVISOR_TOKEN,
            placeholder: '192.168.2.100:8123',
            onPut: () => {
                this.sync();
            }
        },
        protocol: {
            title: 'Protocol',
            description: 'The protocol used to connect to the Home Assistant server. Typically http on port 8123.',
            hide: !!process.env.SUPERVISOR_TOKEN,
            defaultValue: 'http',
            choices: [
                'http',
                'https',
            ],
            onPut: () => {
                this.sync();
            }
        },
        entitiesToFetch: {
            title: 'Entities to fetch',
            multiple: true,
            choices: [],
            combobox: true,
            defaultValue: [],
            onPut: async () => {
                await this.startEntitiesSync();
            }
        },
        devicesToFetch: {
            title: 'Devices to fetch',
            multiple: true,
            choices: [],
            combobox: true,
            defaultValue: [],
            onPut: async () => {
                await this.startEntitiesSync();
            }
        },
    });

    constructor(nativeId?: string) {
        super(nativeId);

        this.sync();
    }

    getSettings(): Promise<Setting[]> {
        return this.storageSettings.getSettings();
    }

    putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }

    getApiUrl() {
        if (process.env.SUPERVISOR_TOKEN)
            return new URL('http://supervisor/core/api/');
        if (!this.storageSettings.values.address)
            throw new Error("address unconfigured");
        return new URL(`${this.storageSettings.values.protocol}://${this.storageSettings.values.address}/api/`);
    }

    getHeaders() {
        return {
            Authorization: `Bearer ${process.env.SUPERVISOR_TOKEN || this.storageSettings.values.personalAccessToken}`,
        }
    }

    async getDevice(nativeId: string): Promise<any> {
        if (nativeId === notifyPrefix) {
            if (this.notifiersProvider) {
                return this.notifiersProvider;
            }

            const ret = new NotifyService(this, notifyPrefix);
            this.notifiersProvider = ret;
            return ret;
        }

        if (nativeId === devicesPrefix) {
            if (this.devicesProvider) {
                return this.devicesProvider;
            }

            const ret = new HaDevice(this, devicesPrefix);
            this.devicesProvider = ret;
            return ret;
        }

    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
    }

    async getEntityDeviceInfo(entityId: string) {
        const payload = {
            template: `{{device_attr('${entityId}','manufacturer')}}||{{device_attr('${entityId}','model')}}`
        };

        const response = await axios.post(new URL('template', this.getApiUrl()).toString(), payload, {
            headers: this.getHeaders(),
            httpsAgent,
        });

        const data = response.data ?? 'None,None';
        let [manufacturer, model] = data.split('||');
        if (!manufacturer || manufacturer === 'None') {
            manufacturer = 'Homeassistant';
        }
        if (!model || model === 'None') {
            model = undefined;
        }

        return {
            manufacturer,
            model,
        }
    }

    async connectWs() {
        if (this.connection) {
            this.connection.close();
        }

        try {
            const auth = createLongLivedTokenAuth(
                this.getApiUrl().origin,
                this.storageSettings.values.personalAccessToken,
            );

            this.connection = await createConnection({ auth });
        } catch (e) {
            throw e;
        }
    }

    buildNativeId(entityData: HaEntityData) {
        const domainMetadata = getDomainMetadata(entityData);

        if (domainMetadata) {
            const { nativeIdPrefix } = domainMetadata;
            const { entity_id } = entityData;
            return `${nativeIdPrefix}:${entity_id}`
        }
    }

    buildDeviceNativeId(deviceId: string) {
        return `${deviceNativeIdPrefix}:${deviceId}`
    }

    async syncDevices() {
        const response = await axios.get(new URL('services', this.getApiUrl()).toString(), {
            headers: this.getHeaders(),
            httpsAgent,
        });
        const json = response.data as any;

        const notify = json.find(service => service.domain === 'notify');
        const { services } = notify;

        const rootManifest: DeviceManifest = {
            devices: [
                {
                    nativeId: notifyPrefix,
                    name: 'Notify Service',
                    interfaces: [
                        ScryptedInterface.DeviceProvider,
                    ],
                    type: ScryptedDeviceType.Builtin,
                },
                {
                    nativeId: devicesPrefix,
                    name: 'Homeassistant devices',
                    interfaces: [
                        ScryptedInterface.DeviceProvider,
                    ],
                    type: ScryptedDeviceType.Builtin,
                }
            ],
        };

        await sdk.deviceManager.onDevicesChanged(rootManifest);

        const notifiersManifest: DeviceManifest = {
            providerNativeId: notifyPrefix,
            devices: [],
        };

        for (const service of Object.keys(services)) {
            notifiersManifest.devices.push({
                nativeId: `${notifyPrefix}:${service}`,
                name: service,
                interfaces: [
                    ScryptedInterface.Notifier,
                ],
                type: ScryptedDeviceType.Notifier,
            });
        }

        await sdk.deviceManager.onDevicesChanged(notifiersManifest);

        const devicesManifest: DeviceManifest = {
            providerNativeId: devicesPrefix,
            devices: [],
        };

        for (const entityId of this.storageSettings.values.entitiesToFetch) {
            const { manufacturer, model } = await this.getEntityDeviceInfo(entityId);
            const entityData: HaEntityData = this.entitiesMap[entityId] ??
                { entity_id: entityId, state: undefined, attributes: { friendly_name: formatEntityIdToDeviceName(entityId) } };
            const deviceName = entityData.attributes.friendly_name;

            const domainMetadata = getDomainMetadata(entityData);

            if (domainMetadata) {
                const { interfaces, type } = domainMetadata;
                devicesManifest.devices.push({
                    providerNativeId: devicesPrefix,
                    nativeId: this.buildNativeId(entityData),
                    name: deviceName,
                    interfaces,
                    type: type as ScryptedDeviceType,
                    info: {
                        manufacturer,
                        model
                    }
                });
            }
        }

        for (const deviceName of this.storageSettings.values.devicesToFetch) {
            try {
                const deviceData = this.devicesMap[this.entityNameToIdMap[deviceName]];
                if (deviceData) {
                    const { name, deviceId, entityIds } = deviceData;
                    const { manufacturer, model } = await this.getEntityDeviceInfo(deviceId);

                    for (const entityId of entityIds) {
                        this.entityIdDeviceIdMap[entityId] = deviceId;
                    }

                    devicesManifest.devices.push({
                        providerNativeId: devicesPrefix,
                        nativeId: this.buildDeviceNativeId(deviceId),
                        name,
                        interfaces: [ScryptedInterface.Sensors, ScryptedInterface.Settings],
                        type: ScryptedDeviceType.Sensor,
                        info: {
                            manufacturer,
                            model
                        }
                    });
                } else {
                    this.console.log(`Device data for ${deviceName} not found`);
                }
            } catch (e) {
                this.console.log(`Error discovering device ${deviceName}`, e);
            }
        }

        await sdk.deviceManager.onDevicesChanged(devicesManifest);
    }

    async fetchAvailableEntities() {
        this.entitiesMap = {};
        const response = await axios.get<HaEntityData[]>(new URL('states', this.getApiUrl()).toString(), {
            headers: this.getHeaders(),
            httpsAgent,
        });

        const filteredEntities =
            response.data
                .filter(entityStatus => supportedDomains.some(domain => (entityStatus.entity_id as string).startsWith(domain)));

        for (const entity of filteredEntities) {
            this.entitiesMap[entity.entity_id] = entity;
        }

        const entityIds = filteredEntities.map(entityStatus => entityStatus.entity_id).sort();
        this.console.log(`Found ${entityIds.length} entities`);

        this.storageSettings.settings.entitiesToFetch.choices = entityIds;
    }

    async fetchAvailableDevices() {
        try {
            this.devicesMap = {};
            this.entityNameToIdMap = {};
            const names: string[] = [];
            const response = await axios.post<string>(new URL('template', this.getApiUrl()).toString(),
                {
                    "template": "{{ states | map(attribute='entity_id') | map('device_id') | unique | reject('eq',None) | list }}"
                },
                {
                    headers: this.getHeaders(),
                    httpsAgent,
                }
            );
            const deviceIds: string[] = JSON.parse(response.data.replaceAll("'", '"'));

            for (const deviceId of deviceIds) {
                const deviceNameResponse = await axios.post<string>(new URL('template', this.getApiUrl()).toString(),
                    {
                        "template": `{{ device_attr('${deviceId}', 'name') }}`
                    },
                    {
                        headers: this.getHeaders(),
                        httpsAgent,
                    }
                );
                const deviceEntitiesResponse = await axios.post<string>(new URL('template', this.getApiUrl()).toString(),
                    {
                        "template": `{{ device_entities('${deviceId}') }}`
                    },
                    {
                        headers: this.getHeaders(),
                        httpsAgent,
                    }
                );

                const name = deviceNameResponse.data;
                if (name && !names.includes(name)) {
                    names.push(name);
                    this.entityNameToIdMap[name] = deviceId;
                    this.devicesMap[deviceId] = {
                        deviceId,
                        name,
                        entityIds: JSON.parse(deviceEntitiesResponse.data.replaceAll("'", '"'))
                    }
                }
            }

            this.console.log(`Found ${names.length} devices`);

            this.storageSettings.settings.devicesToFetch.choices = names.sort();
        } catch (e) {
            this.console.log('Error in fetchAvailableDevices', e);
        }
    }

    async startEntitiesSync() {
        if (this.connection) {
            if (this.wsUnsubFn) {
                this.wsUnsubFn();
                this.wsUnsubFn = undefined;
            }

            const { entitiesToFetch, devicesToFetch } = this.storageSettings.values;
            const entityIds: string[] = [
                ...entitiesToFetch ?? [],
            ];

            for (const deviceName of devicesToFetch) {
                try {
                    const deviceData = this.devicesMap[this.entityNameToIdMap[deviceName]];
                    if (deviceData) {
                        const { entityIds: deviceEntityIds } = deviceData;
                        entityIds.push(...(deviceEntityIds ?? []));
                    }
                } catch { }
            }

            if (entityIds.length) {
                this.console.log(`Subscribing to ${entityIds.length} entities: ${JSON.stringify(entityIds)}`);
                this.wsUnsubFn = subscribeEntities(this.connection, entityIds, async (entities: Record<string, HaEntityData>) => {
                    // this.console.log(`Entities update received: ${JSON.stringify(entities)}`);
                    try {
                        for (const entity of Object.values(entities)) {
                            const { entity_id } = entity;

                            // Check if the entity is ingesteded as Device standalone
                            if (this.storageSettings.values.entitiesToFetch.includes(entity_id)) {
                                let device = this.deviceMap[entity_id];

                                if (!device) {
                                    const nativeId = this.buildNativeId(entity);
                                    if (nativeId) {
                                        device = this.devicesProvider.getDeviceInternal(nativeId);
                                    }
                                }

                                if (device) {
                                    await device.updateState(entity);
                                }
                            }

                            // Check if the entity is ingesteded as Sensors device
                            const deviceId = this.entityIdDeviceIdMap[entity_id];
                            if (deviceId) {
                                let device = this.deviceMap[deviceId];

                                if (!device) {
                                    const nativeId = this.buildDeviceNativeId(deviceId);
                                    if (nativeId) {
                                        device = this.devicesProvider.getDeviceInternal(nativeId);
                                    }
                                }

                                if (device) {
                                    await device.updateState(entity);
                                }
                            }
                        }

                    } catch (e) {
                        this.console.log('Error in subscribeEntities', e);
                    }
                });
            } else {
                this.console.log('No entities to subscribe');
            }
        }
    }

    async sync() {
        let isConnected = false;
        let currentTry = 1;

        while (!isConnected && currentTry < maxRetries) {
            try {
                currentTry++;
                await this.connectWs();
                isConnected = true;
                this.console.log('Connection to WS succeded');
            } catch (e) {
                this.console.log(`Error ${e} on WS connection, waiting ${retryDelay} seconds`);

                await sleep(retryDelay * 1000);
            }
        }

        if (!isConnected) {
            this.console.log(`Connection to WS could not be estabilished after ${maxRetries} retries. Check your Homeassistant instance and restart this plugin`);
            return;
        }

        await this.fetchAvailableDevices();
        await this.fetchAvailableEntities();
        await this.syncDevices();
        await this.startEntitiesSync();
    }
}

export default HomeAssistantPlugin;
