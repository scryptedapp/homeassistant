import sdk, { DeviceManifest, DeviceProvider, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface, Setting, Settings, SettingValue } from '@scrypted/sdk';
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import axios from 'axios';
import {
    createConnection,
    createLongLivedTokenAuth,
    subscribeEntities,
} from "home-assistant-js-websocket";
import { HaDevice } from './device';
import { httpsAgent } from './httpsagent';
import { NotifyService } from './notify';
import { HaBaseDevice } from './types/baseDevice';
import { domainMetadataMap, formatEntityIdToDeviceName, getDomainMetadata, HaEntityData, supportedDomains } from './utils';
import { HaWebsocket } from './websocket';
import { clearWWWDirectory } from './www';

globalThis.WebSocket = HaWebsocket as any;

const notifyPrefix = 'notify';
const devicesPrefix = 'haDevices';

if (process.env.SUPERVISOR_TOKEN)
    clearWWWDirectory();

class HomeAssistantPlugin extends ScryptedDeviceBase implements DeviceProvider, Settings {
    connection: any;
    processing: boolean;
    deviceMap: Record<string, HaBaseDevice> = {};
    entitiesMap: Record<string, HaEntityData> = {};

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
            onPut: () => {
                this.sync();
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
        if (nativeId === notifyPrefix)
            return new NotifyService(this, notifyPrefix);

        if (nativeId === devicesPrefix) {
            return new HaDevice(this, devicesPrefix);
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
            this.console.error('Error in WS subscription', e);
        }
    }

    async syncDevices() {
        const response = await axios.get(new URL('services', this.getApiUrl()).toString(), {
            headers: this.getHeaders(),
            httpsAgent,
        });
        const json = response.data as any;
        this.console.log('Services response', JSON.stringify(json));

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
                const { interfaces, nativeIdPrefix, type } = domainMetadata;
                devicesManifest.devices.push({
                    providerNativeId: devicesPrefix,
                    nativeId: `${nativeIdPrefix}:${entityId}`,
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
        this.console.log('Entity IDs found:', entityIds);

        this.storageSettings.settings.entitiesToFetch.choices = entityIds;
    }

    async startEntitiesSync() {
        if (this.connection) {
            subscribeEntities(this.connection, (entities: Record<string, HaEntityData>) => {
                if (!this.processing) {
                    try {
                        this.processing = true;

                        const filteredEntities = Object.entries(entities)
                            .filter(([entityId,]) => this.storageSettings.values.entitiesToFetch.includes(entityId))
                            .map(([_, data]) => data);

                        for (const entity of filteredEntities) {
                            const { entity_id } = entity;
                            const device = this.deviceMap[entity_id];

                            if (device) {
                                device.updateState(entity);
                            }
                        }

                    } catch (e) {
                        this.console.log('Error in subscribeEntities', e);
                    } finally {
                        this.processing = false;
                    }
                }
            });
        }
    }

    async sync() {
        await this.connectWs();
        await this.fetchAvailableEntities();
        await this.syncDevices();
        await this.startEntitiesSync();
    }
}

export default HomeAssistantPlugin;
