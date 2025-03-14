import sdk, { AdoptDevice, Device, DeviceDiscovery, DeviceManifest, DeviceProvider, DiscoveredDevice, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface, Setting, Settings, SettingValue } from '@scrypted/sdk';
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
import { buildDomainQuery, deviceNativeIdPrefix, DomainMetadata, DomainQueryResultItem, formatEntityIdToDeviceName, getDomainMetadata, HaDeviceData, HaEntityData, isEntitySupported, subscribeEntities, supportedDomains } from './utils';
import { HaWebsocket } from './websocket';
import { clearWWWDirectory } from './www';
import { sleep } from '../../scrypted/common/src/sleep';

globalThis.WebSocket = HaWebsocket as any;

export const notifyPrefix = 'notify';
export const devicesPrefix = 'haDevices';
const retryDelay = 10;
const maxRetries = 20;

if (process.env.SUPERVISOR_TOKEN)
    clearWWWDirectory();

class HomeAssistantPlugin extends ScryptedDeviceBase implements DeviceProvider, Settings, DeviceDiscovery {
    connection: any;
    deviceMap: Record<string, HaBaseDevice> = {};
    entitiesMap: Record<string, HaEntityData> = {};
    nativeIdEntityIdMap: Record<string, string> = {};
    devicesMap: Record<string, HaDeviceData> = {};
    // Entities can belong to only 1 device
    entityIdDeviceIdMap: Record<string, string> = {};
    notifiersProvider: NotifyService;
    devicesProvider: HaDevice;
    wsUnsubFn: () => void;
    lastEventReceived: number;
    lastRefresh: number;
    disconnectionCheckInterval: NodeJS.Timeout;
    connecting: boolean;
    discoveredDevices = new Map<string, {
        device: Device;
        description: string;
    }>();

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
        // entitiesToFetch: {
        //     title: 'Entities to fetch',
        //     multiple: true,
        //     choices: [],
        //     combobox: true,
        //     defaultValue: [],
        //     onPut: async () => {
        //         await this.startEntitiesSync();
        //     }
        // },
        // devicesToFetch: {
        //     title: 'Devices to fetch',
        //     multiple: true,
        //     choices: [],
        //     combobox: true,
        //     defaultValue: [],
        //     onPut: async () => {
        //         await this.startEntitiesSync();
        //     }
        // }
    });

    constructor(nativeId?: string) {
        super(nativeId);

        this.init().catch(this.console.error);
    }

    async init() {
        // Check every 30 seconds if an event was received in the latest 10 minutes, if not most likely the WS died
        this.disconnectionCheckInterval = setInterval(async () => {
            const shouldReconnect = !this.lastEventReceived || (Date.now() - this.lastEventReceived) > 1000 * 60 * 10;
            if (shouldReconnect && !this.connecting) {
                this.console.log('No event received in the last 10 minutes, reconnecting');
                await this.sync();
            }
        }, 1000 * 30);

        await this.sync();
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

    buildNativeId(entityData: HaEntityData, metadata?: DomainMetadata) {
        const domainMetadata = metadata ?? getDomainMetadata(entityData);

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

        await sdk.deviceManager.onDeviceDiscovered({
            nativeId: notifyPrefix,
            name: 'Notify Service',
            interfaces: [
                ScryptedInterface.DeviceProvider,
            ],
            type: ScryptedDeviceType.Builtin,
        });
        await sdk.deviceManager.onDeviceDiscovered({
            nativeId: devicesPrefix,
            name: 'Homeassistant devices',
            interfaces: [
                ScryptedInterface.DeviceProvider,
            ],
            type: ScryptedDeviceType.Builtin,
        });

        // for (const service of Object.keys(services)) {
        //     await sdk.deviceManager.onDeviceDiscovered({
        //         providerNativeId: notifyPrefix,
        //         nativeId: `${notifyPrefix}:${service}`,
        //         name: service,
        //         interfaces: [
        //             ScryptedInterface.Notifier,
        //         ],
        //         type: ScryptedDeviceType.Notifier,
        //     });
        // }

        // for (const entityId of this.storageSettings.values.entitiesToFetch) {
        //     const { manufacturer, model } = await this.getEntityDeviceInfo(entityId);
        //     const entityData: HaEntityData = this.entitiesMap[entityId] ??
        //         { entity_id: entityId, state: undefined, attributes: { friendly_name: formatEntityIdToDeviceName(entityId) } };
        //     const deviceName = entityData.attributes.friendly_name;

        //     const domainMetadata = getDomainMetadata(entityData);

        //     if (domainMetadata) {
        //         const { interfaces, type } = domainMetadata;

        //         await sdk.deviceManager.onDeviceDiscovered({
        //             providerNativeId: devicesPrefix,
        //             nativeId: this.buildNativeId(entityData),
        //             name: deviceName,
        //             interfaces,
        //             type: type as ScryptedDeviceType,
        //             info: {
        //                 manufacturer,
        //                 model
        //             }
        //         });
        //     }
        // }

        // for (const deviceName of this.storageSettings.values.devicesToFetch) {
        //     try {
        //         const deviceData = this.devicesMap[this.entityNameToIdMap[deviceName]];
        //         if (deviceData) {
        //             const { name, deviceId, entityIds } = deviceData;
        //             const { manufacturer, model } = await this.getEntityDeviceInfo(deviceId);

        //             for (const entityId of entityIds) {
        //                 this.entityIdDeviceIdMap[entityId] = deviceId;
        //             }

        //             await sdk.deviceManager.onDeviceDiscovered({
        //                 providerNativeId: devicesPrefix,
        //                 nativeId: this.buildDeviceNativeId(deviceId),
        //                 name,
        //                 interfaces: [ScryptedInterface.Sensors, ScryptedInterface.Settings],
        //                 type: ScryptedDeviceType.Sensor,
        //                 info: {
        //                     manufacturer,
        //                     model
        //                 }
        //             });
        //         } else {
        //             this.console.log(`Device data for ${deviceName} not found`);
        //         }
        //     } catch (e) {
        //         this.console.log(`Error discovering device ${deviceName}`, e);
        //     }
        // }
    }

    // async fetchAvailableDevices() {
    //     try {
    //         this.devicesMap = {};
    //         this.entityNameToIdMap = {};
    //         const names: string[] = [];
    //         const response = await axios.post<string>(new URL('template', this.getApiUrl()).toString(),
    //             {
    //                 "template": "{{ states | map(attribute='entity_id') | map('device_id') | unique | reject('eq',None) | list }}"
    //             },
    //             {
    //                 headers: this.getHeaders(),
    //                 httpsAgent,
    //             }
    //         );
    //         const deviceIds: string[] = JSON.parse(response.data.replaceAll("'", '"'));

    //         for (const deviceId of deviceIds) {
    //             const deviceNameResponse = await axios.post<string>(new URL('template', this.getApiUrl()).toString(),
    //                 {
    //                     "template": `{{ device_attr('${deviceId}', 'name') }}`
    //                 },
    //                 {
    //                     headers: this.getHeaders(),
    //                     httpsAgent,
    //                 }
    //             );
    //             const deviceEntitiesResponse = await axios.post<string>(new URL('template', this.getApiUrl()).toString(),
    //                 {
    //                     "template": `{{ device_entities('${deviceId}') }}`
    //                 },
    //                 {
    //                     headers: this.getHeaders(),
    //                     httpsAgent,
    //                 }
    //             );

    //             const name = deviceNameResponse.data;
    //             const entityIds = JSON.parse(deviceEntitiesResponse.data.replaceAll("'", '"'));
    //             const anySupportedEntity = entityIds.some(entityId => isEntitySupported(entityId));
    //             if (name && !names.includes(name) && anySupportedEntity) {
    //                 names.push(name);
    //                 this.entityNameToIdMap[name] = deviceId;
    //                 this.devicesMap[deviceId] = {
    //                     deviceId,
    //                     name,
    //                     entityIds
    //                 }
    //             }
    //         }

    //         this.console.log(`Found ${names.length} devices`);
    //         this.console.log(JSON.stringify(Object.values(this.devicesMap)));

    //         // this.storageSettings.settings.devicesToFetch.choices = names.sort();
    //     } catch (e) {
    //         this.console.log('Error in fetchAvailableDevices', e);
    //     }
    // }

    async startEntitiesSync() {
        if (this.connection) {
            if (this.wsUnsubFn) {
                this.wsUnsubFn();
                this.wsUnsubFn = undefined;
            }

            // const { entitiesToFetch, devicesToFetch } = this.storageSettings.values;
            // const entityIds: string[] = [
            //     ...entitiesToFetch ?? [],
            // ];

            // for (const deviceName of devicesToFetch) {
            //     try {
            //         const deviceData = this.devicesMap[this.entityNameToIdMap[deviceName]];
            //         if (deviceData) {
            //             const { entityIds: deviceEntityIds } = deviceData;
            //             entityIds.push(...(deviceEntityIds ?? []));
            //         }
            //     } catch { }
            // }

            const entityIds = sdk.deviceManager.getNativeIds()
                .map(nativeId => this.nativeIdEntityIdMap[nativeId])
                .filter(nativeId => !!nativeId);

            if (entityIds.length) {
                // this.console.log(`Subscribing to ${entityIds.length} entities: ${JSON.stringify(entityIds)}`);
                // this.wsUnsubFn = subscribeEntities(this.connection, entityIds, async (entities: Record<string, HaEntityData>) => {
                //     // this.console.log(`Entities update received: ${JSON.stringify(entities)}`);
                //     this.lastEventReceived = Date.now();
                //     try {
                //         for (const entity of Object.values(entities)) {
                //             const { entity_id } = entity;

                //             // Check if the entity is ingesteded as Device standalone
                //             if (this.storageSettings.values.entitiesToFetch.includes(entity_id)) {
                //                 let device = this.deviceMap[entity_id];

                //                 if (!device) {
                //                     const nativeId = this.buildNativeId(entity);
                //                     if (nativeId) {
                //                         device = this.devicesProvider.getDeviceInternal(nativeId);
                //                     }
                //                 }

                //                 if (device) {
                //                     await device.updateState(entity);
                //                 }
                //             }

                //             // Check if the entity is ingesteded as Sensors device
                //             const deviceId = this.entityIdDeviceIdMap[entity_id];
                //             if (deviceId) {
                //                 let device = this.deviceMap[deviceId];

                //                 if (!device) {
                //                     const nativeId = this.buildDeviceNativeId(deviceId);
                //                     if (nativeId) {
                //                         device = this.devicesProvider.getDeviceInternal(nativeId);
                //                     }
                //                 }

                //                 if (device) {
                //                     await device.updateState(entity);
                //                 }
                //             }
                //         }

                //     } catch (e) {
                //         this.console.log('Error in subscribeEntities', e);
                //     }
                // });
            } else {
                this.console.log('No entities to subscribe');
            }
        }
    }

    async sync() {
        this.connecting = true;
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
        this.connecting = false;

        if (!isConnected) {
            this.console.log(`Connection to WS could not be estabilished after ${maxRetries} retries. Check your Homeassistant instance and restart this plugin`);
            return;
        }

        // await this.fetchAvailableDevices();
        // await this.fetchAvailableEntities();
        // await this.syncDevices();
        await this.startEntitiesSync();
    }

    async syncEntitiesFromRemote() {
        this.entitiesMap = {};
        this.nativeIdEntityIdMap = {};
        this.devicesMap = {};
        this.entityIdDeviceIdMap = {};

        for (const domain of supportedDomains) {
            const payload = {
                template: buildDomainQuery(domain)
            };

            try {
                const domainResponse = await axios.post<DomainQueryResultItem[]>(new URL('template', this.getApiUrl()).toString(), payload, {
                    headers: this.getHeaders(),
                    httpsAgent,
                });

                this.console.log(`Found ${domainResponse.data.length} entities for domain ${domain}`);
                for (const entityData of domainResponse.data) {
                    const { entity_id, attributes: { friendly_name }, device_id, manufacturer, model, name } = entityData;
                    const domainMetadata = getDomainMetadata(entityData);
                    const nativeId = this.buildNativeId(entityData, domainMetadata);
                    this.nativeIdEntityIdMap[nativeId] = entity_id;
                    this.entitiesMap[entity_id] = entityData;
                    if (device_id) {
                        this.entityIdDeviceIdMap[entity_id] = device_id;
                    }

                    if (domainMetadata) {
                        const { interfaces, type } = domainMetadata;

                        if (sdk.deviceManager.getNativeIds().includes(nativeId) || this.discoveredDevices.has(nativeId))
                            continue;

                        this.discoveredDevices.set(nativeId, {
                            device: {
                                nativeId,
                                name: friendly_name,
                                interfaces,
                                type: type as ScryptedDeviceType,
                                info: {
                                    manufacturer,
                                    model
                                }
                            },
                            description: `${friendly_name}`,
                        });
                    }
                }
            } catch (e) {
                this.console.error(`Error fetching data for the domain ${domain}`, e);
            }
        }

        const notifiersRsponse = await axios.get(new URL('services', this.getApiUrl()).toString(), {
            headers: this.getHeaders(),
            httpsAgent,
        });

        const notify = notifiersRsponse.data.find(service => service.domain === 'notify');
        const { services } = notify;
        for (const service of Object.keys(services)) {
            const nativeId = `${notifyPrefix}:${service}`;

            if (sdk.deviceManager.getNativeIds().includes(nativeId) || this.discoveredDevices.has(nativeId))
                continue;

            this.discoveredDevices.set(nativeId, {
                device: {
                    nativeId,
                    name: service,
                    interfaces: [
                        ScryptedInterface.Notifier,
                    ],
                    type: ScryptedDeviceType.Notifier,
                },
                description: `${service}`,
            });
        }
    }

    async discoverDevices(scan?: boolean): Promise<DiscoveredDevice[]> {
        if (scan) {
            await this.syncEntitiesFromRemote();
        }

        return [...this.discoveredDevices.values()].map(d => ({
            ...d.device,
            description: d.description,
        }));
    }

    async adoptDevice(adopt: AdoptDevice): Promise<string> {
        const entry = this.discoveredDevices.get(adopt.nativeId);
        // this.onDeviceEvent(ScryptedInterface.DeviceDiscovery, await this.discoverDevices());
        if (!entry)
            throw new Error('device not found');
        // await this.createDevice(adopt.settings, adopt.nativeId);
        this.discoveredDevices.delete(adopt.nativeId);
        // const device = await this.getDevice(adopt.nativeId) as OnvifCamera;
        // return device.id;
        return null
    }
}

export default HomeAssistantPlugin;
