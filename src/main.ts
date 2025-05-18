import sdk, { AdoptDevice, Device, DeviceDiscovery, DeviceProvider, DiscoveredDevice, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface, Setting, Settings, SettingValue } from '@scrypted/sdk';
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import axios from 'axios';
import {
    createConnection,
    createLongLivedTokenAuth,
} from "home-assistant-js-websocket";
import { sleep } from '../../scrypted/common/src/sleep';
import { httpsAgent } from './httpsagent';
import { NotifyDevice } from './notify';
import { HaBaseDevice } from './types/baseDevice';
import { HaSensors } from './types/sensors';
import { buildDevicesTemplate, DevicesQueryResultItem, DomainMetadata, formatEntityIdToDeviceName, getDomainMetadata, getSensorType, HaDeviceData, HaDomain, HaEntityData, subscribeEntities, supportedDomains } from './utils';
import { Auth, HaWebsocket } from './websocket';
import { clearWWWDirectory } from './www';

globalThis.WebSocket = HaWebsocket as any;

const retryDelay = 10;
const maxRetries = 100;

if (process.env.SUPERVISOR_TOKEN)
    clearWWWDirectory();

class HomeAssistantPlugin extends ScryptedDeviceBase implements DeviceProvider, Settings, DeviceDiscovery {
    connection: any;
    deviceMap: Record<string, HaBaseDevice> = {};
    entitiesDataMap: Record<string, HaEntityData> = {};
    notifiersMap: Record<string, NotifyDevice> = {};
    nativeIdEntityIdMap: Record<string, string> = {};
    devicesDataMap: Record<string, HaDeviceData> = {};
    // Entities can belong to only 1 device
    entityIdDeviceIdMap: Record<string, string> = {};
    wsUnsubFn: () => void;
    lastEventReceived: number;
    lastConnection: number;
    lastRefresh: number;
    disconnectionCheckInterval: NodeJS.Timeout;
    connecting: boolean;
    processing: boolean;
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
                this.startWeboscket();
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
                this.startWeboscket();
            }
        },
        debug: {
            title: 'Debug events',
            type: 'boolean',
            subgroup: 'Advanced',
            immediate: true,
        },
    });

    constructor(nativeId?: string) {
        super(nativeId);

        this.init().catch(this.console.error);
    }

    async init() {
        // Check every 30 seconds if an event was received in the latest 10 minutes, if not most likely the WS died
        this.disconnectionCheckInterval = setInterval(async () => {
            const now = Date.now();
            const lastEventOld = !this.lastEventReceived || (now - this.lastEventReceived) > 1000 * 60 * 10;
            const lastConnectionOld = !this.lastConnection || (now - this.lastConnection) > 1000 * 60 * 60;
            const shouldReconnect = lastEventOld || lastConnectionOld;
            if (shouldReconnect && !this.connecting) {
                this.console.log(`Reconnecting, lastEventOld ${lastEventOld} lastConnectionOld ${lastConnectionOld}`);
                await this.startWeboscket();
            }
        }, 1000 * 30);

        await this.discoverDevices(true);
        await this.startWeboscket();
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
        const [domain] = nativeId.split(':');
        if (domain === HaDomain.Notify) {
            if (this.notifiersMap[nativeId]) {
                return this.notifiersMap[nativeId];
            }

            const ret = new NotifyDevice(this, nativeId);
            this.notifiersMap[nativeId] = ret;
            return ret;
        } else {
            if (this.notifiersMap[nativeId]) {
                return this.notifiersMap[nativeId];
            }

            const ret = this.getEntityOrDevice(nativeId);
            this.deviceMap[nativeId] = ret;
            return ret;
        }
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
        await this.init();
    }

    async disconnectWs() {
        if (this.connection) {
            this.connection.close();
        }
    }

    async connectWs() {
        this.disconnectWs();

        try {
            let auth;

            if (process.env.SUPERVISOR_TOKEN) {
                auth = new Auth({ supervisorToken: process.env.SUPERVISOR_TOKEN });
            } else {
                auth = createLongLivedTokenAuth(
                    this.getApiUrl().origin,
                    this.storageSettings.values.personalAccessToken,
                );
            }

            this.connection = await createConnection({
                auth
            });
        } catch (e) {
            throw e;
        }
    }

    buildEntityNativeId(entityData: HaEntityData, metadata?: DomainMetadata) {
        const domainMetadata = metadata ?? getDomainMetadata(entityData);

        if (domainMetadata) {
            const { nativeIdPrefix } = domainMetadata;
            const { entity_id } = entityData;
            return `${nativeIdPrefix}:${entity_id}`
        }
    }

    buildDeviceNativeId(deviceId: string) {
        return `${HaDomain.Device}:${deviceId}`
    }

    getEntityOrDevice(nativeId: string) {
        try {
            const [domain, entityId] = nativeId.split(':');
            let device;

            if (domain === HaDomain.Device) {
                const deviceData = this.devicesDataMap[entityId];

                if (deviceData) {
                    const { entityIds } = deviceData;
                    const entities = entityIds.map(innerEntityId => this.entitiesDataMap[innerEntityId])
                        .filter(entity => !!entity);
                    device = new HaSensors(this, nativeId, entities);
                }
            } else {
                const entityData = this.entitiesDataMap[entityId];
                if (entityData) {
                    const DeviceConstructor = getDomainMetadata(entityData)?.deviceConstructor;

                    if (DeviceConstructor) {
                        device = new DeviceConstructor(this, nativeId, entityData);
                    }
                }
            }

            if (device) {
                device.refreshConfiguration();
                return device;
            }
        } catch (e) {
            this.console.log('Error in device getDeviceInternal', e);
        }
    }

    async startWeboscket() {
        this.connecting = true;
        let isConnected = false;
        let currentTry = 1;

        while (!isConnected && currentTry < maxRetries) {
            try {
                currentTry++;
                await this.connectWs();
                isConnected = true;
                this.lastConnection = Date.now();
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

        if (this.connection) {
            if (this.wsUnsubFn) {
                this.wsUnsubFn();
                this.wsUnsubFn = undefined;
            }

            const singleEntityEnabled: Record<string, boolean> = {};
            const entityIds: string[] = [];
            const nativeIds = sdk.deviceManager.getNativeIds();
            for (const nativeId of nativeIds) {
                if (!nativeId) {
                    continue;
                }
                const [domain, entityId] = nativeId.split(':');
                if (domain === HaDomain.Device) {
                    const relatedEntityIds = Object.entries(this.entityIdDeviceIdMap)
                        .filter(([innerEntityId, deviceId]) =>
                            !!innerEntityId && !!deviceId && entityId === deviceId
                        )
                        .map(([innerEntityId]) => innerEntityId);

                    entityIds.push(...relatedEntityIds);
                } else if (domain === HaDomain.Notify) {
                    // no-op
                } else {
                    if (entityId) {
                        entityIds.push(entityId);
                        singleEntityEnabled[entityId] = true;
                    }
                }
            }

            if (entityIds.length) {
                this.console.log(`Subscribing to ${entityIds.length} entities`);

                if (this.storageSettings.values.debug) {
                    this.console.log(`${JSON.stringify({ entityIds })}`);
                }

                this.wsUnsubFn = subscribeEntities(this.connection, entityIds, async (entities: Record<string, HaEntityData>) => {
                    if (this.storageSettings.values.debug) {
                        this.console.log(`Entities update received: ${JSON.stringify(entities)}`);
                    }

                    this.lastEventReceived = Date.now();
                    if (this.processing) {
                        return;
                    }
                    this.processing = true;
                    try {
                        const currentNativeIds = sdk.deviceManager.getNativeIds();
                        for (const entity of Object.values(entities)) {
                            const { entity_id } = entity;

                            // Check if the entity is ingesteded as Entity device standalone
                            if (singleEntityEnabled[entity_id]) {
                                const entityNativeId = this.buildEntityNativeId(entity);

                                if (entityNativeId && currentNativeIds.includes(entityNativeId)) {
                                    let device = this.deviceMap[entityNativeId];

                                    if (!device) {
                                        device = this.getEntityOrDevice(entityNativeId);
                                        this.deviceMap[entityNativeId] = device;
                                    }

                                    if (device) {
                                        await device.updateStateParent(entity);
                                    }
                                }
                            }

                            const deviceId = this.entityIdDeviceIdMap[entity_id];
                            // Check if the entity is ingesteded as Sensors device
                            if (deviceId) {
                                let device = this.deviceMap[deviceId];

                                if (!device) {
                                    const deviceNativeId = this.buildDeviceNativeId(deviceId);

                                    if (deviceNativeId && currentNativeIds.includes(deviceNativeId)) {
                                        device = this.getEntityOrDevice(deviceNativeId);
                                        this.deviceMap[deviceNativeId] = device;
                                    }
                                }

                                if (device) {
                                    await device.updateStateParent(entity);
                                }
                            }
                        }

                    } catch (e) {
                        this.console.log('Error in subscribeEntities', e);
                    } finally {
                        this.processing = false;
                    }
                });
            } else {
                this.console.log('No entities to subscribe');
            }
        }
    }

    async syncEntitiesFromRemote() {
        this.entitiesDataMap = {};
        this.nativeIdEntityIdMap = {};
        this.devicesDataMap = {};
        this.entityIdDeviceIdMap = {};

        const allEntitiesResponse = await axios.get<HaEntityData[]>(new URL('states', this.getApiUrl()).toString(), {
            headers: this.getHeaders(),
            httpsAgent,
        });

        for (const domain of supportedDomains) {
            try {
                const allDomainEntities = allEntitiesResponse.data.filter(entity => entity.entity_id.split('.')[0] === domain).map(entity => entity.entity_id);

                const size = Math.max(1, Math.floor(100));
                const chunks = [];

                for (let i = 0; i < allDomainEntities.length; i += size) {
                    chunks.push(allDomainEntities.slice(i, i + size));
                }

                for (const chunk of chunks) {
                    const payload = {
                        template: buildDevicesTemplate(chunk)
                    };
                    const devicesResponse = await axios.post<DevicesQueryResultItem[]>(new URL('template', this.getApiUrl()).toString(), payload, {
                        headers: this.getHeaders(),
                        httpsAgent,
                    });
                    const devices = devicesResponse.data;

                    for (const { area, entities: deviceEntities, id, model, name, manufacturer } of devices) {
                        if (!this.devicesDataMap[id]) {
                            this.devicesDataMap[id] = {
                                area,
                                deviceId: id,
                                entityIds: [],
                                manufacturer,
                                model,
                                name
                            }
                        }

                        for (const entityId of deviceEntities) {
                            this.entityIdDeviceIdMap[entityId] = id;
                            this.devicesDataMap[id].entityIds.push(entityId);
                        }
                    }
                }
            } catch (e) {
                this.console.error(`Error fetching data for the domain ${domain}`, e);
            }
        }

        const entities = allEntitiesResponse.data.filter((entity) => {
            const { entity_id } = entity;
            const [domain] = entity_id.split('.');
            if (!supportedDomains.includes(domain as HaDomain)) {
                return false;
            } else if (domain === HaDomain.Sensor) {
                return getSensorType(entity)?.isSupported;
            } else {
                return true
            }
        });

        for (const entityData of entities) {
            const { entity_id, attributes: { friendly_name } } = entityData;
            const domainMetadata = getDomainMetadata(entityData);
            const nativeId = this.buildEntityNativeId(entityData, domainMetadata);
            this.nativeIdEntityIdMap[nativeId] = entity_id;
            this.entitiesDataMap[entity_id] = entityData;

            if (domainMetadata) {
                const { interfaces, type } = domainMetadata;
                const device: Device = {
                    nativeId,
                    name: friendly_name || formatEntityIdToDeviceName(entity_id),
                    interfaces,
                    type: type as ScryptedDeviceType,
                };

                const deviceId = this.entityIdDeviceIdMap[entity_id];
                if (deviceId) {
                    const deviceData = this.devicesDataMap[deviceId];
                    device.info = {
                        manufacturer: deviceData.manufacturer,
                        model: deviceData.model,
                    }
                    device.room = deviceData.area;
                }

                if (sdk.deviceManager.getNativeIds().includes(nativeId)) {
                    sdk.deviceManager.onDeviceDiscovered(device);
                    continue;
                }

                if (this.discoveredDevices.has(nativeId)) {
                    continue;
                }

                this.discoveredDevices.set(nativeId, {
                    device,
                    description: `${friendly_name}`,
                });
            }
        }

        const deviceIds = Object.keys(this.devicesDataMap)

        this.console.log(`Entities found to discover: ${JSON.stringify({
            entities: entities.length,
            devices: deviceIds.length
        })}`);

        for (const deviceId of deviceIds) {
            const { name, manufacturer, model } = this.devicesDataMap[deviceId];

            const nativeId = this.buildDeviceNativeId(deviceId);
            const device: Device = {
                nativeId,
                name: `${name} (Device)`,
                interfaces: [ScryptedInterface.Sensors, ScryptedInterface.Settings],
                type: ScryptedDeviceType.Sensor,
                info: {
                    manufacturer,
                    model
                }
            };

            if (sdk.deviceManager.getNativeIds().includes(nativeId)) {
                sdk.deviceManager.onDeviceDiscovered(device);
                continue;
            }

            if (this.discoveredDevices.has(nativeId)) {
                continue;
            }

            this.discoveredDevices.set(nativeId, {
                device,
                description: `${name}`,
            });
        }

        const notifiersRsponse = await axios.get(new URL('services', this.getApiUrl()).toString(), {
            headers: this.getHeaders(),
            httpsAgent,
        });

        const notify = notifiersRsponse.data.find(service => service.domain === 'notify');
        const { services } = notify;
        for (const service of Object.keys(services)) {
            const nativeId = `${HaDomain.Notify}:${service}`;
            const device: Device = {
                nativeId,
                name: service,
                interfaces: [
                    ScryptedInterface.Notifier,
                ],
                type: ScryptedDeviceType.Notifier,
            };

            if (sdk.deviceManager.getNativeIds().includes(nativeId)) {
                sdk.deviceManager.onDeviceDiscovered(device);
                continue;
            }

            if (this.discoveredDevices.has(nativeId)) {
                continue;
            }

            this.discoveredDevices.set(nativeId, {
                device,
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
        await this.onDeviceEvent(ScryptedInterface.DeviceDiscovery, await this.discoverDevices());

        if (!entry)
            throw new Error('device not found');

        await sdk.deviceManager.onDeviceDiscovered(entry.device);
        this.discoveredDevices.delete(adopt.nativeId);
        this.disconnectWs();
        await this.startWeboscket();
        const device = this.getEntityOrDevice(adopt.nativeId);
        return device?.id;
    }
}

export default HomeAssistantPlugin;
