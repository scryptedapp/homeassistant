import sdk, { DeviceManifest, DeviceProvider, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface, Setting, SettingValue, Settings } from '@scrypted/sdk';
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import { NotifyService } from './notify';
import { clearWWWDirectory } from './www';
import axios from 'axios';
import https from 'https';

export const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

if (process.env.SUPERVISOR_TOKEN)
    clearWWWDirectory();

class HomeAssistantPlugin extends ScryptedDeviceBase implements DeviceProvider, Settings {
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
        if (nativeId === 'notify')
            return new NotifyService(this, 'notify');
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
    }

    async sync() {
        const response = await axios.get(new URL('services', this.getApiUrl()).toString(), {
            headers: this.getHeaders(),
            httpsAgent,
        });
        const json = response.data as any;
        this.console.log(json);

        const notify = json.find(service => service.domain === 'notify');
        const { services } = notify;

        const rootManifest: DeviceManifest = {
            devices: [
                {
                    nativeId: 'notify',
                    name: 'Notify Service',
                    interfaces: [
                        ScryptedInterface.DeviceProvider,
                    ],
                    type: ScryptedDeviceType.Builtin,
                }
            ],
        };

        await sdk.deviceManager.onDevicesChanged(rootManifest);

        const manifest: DeviceManifest = {
            providerNativeId: 'notify',
            devices: [],
        };

        for (const service of Object.keys(services)) {
            manifest.devices.push({
                nativeId: `notify:${service}`,
                name: service,
                interfaces: [
                    ScryptedInterface.Notifier,
                ],
                type: ScryptedDeviceType.Notifier,
            });
        }

        await sdk.deviceManager.onDevicesChanged(manifest);
    }
}

export default HomeAssistantPlugin;
