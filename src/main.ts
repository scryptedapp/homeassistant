import sdk, { DeviceManifest, DeviceProvider, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface, Setting, SettingValue, Settings } from '@scrypted/sdk';
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import { NotifyService } from './notify';

if (!process.env.SUPERVISOR_TOKEN)
    sdk.log.a('Scrypted must be installed as a Home Assistant Addon. The plugin does not support the current installation method yet.');

class HomeAssistantPlugin extends ScryptedDeviceBase implements DeviceProvider, Settings {
    storageSettings = new StorageSettings(this, {
        personalAccessToken: {
            title: 'Personal Access Token',
            description: 'Provide a personal access token for your Home Assistant user. Needed to support navigation back into the Scrypted addon.',
        }
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
        return new URL('http://supervisor/core/api/');
    }
    getHeaders() {
        return {
            Authorization: `Bearer ${process.env.SUPERVISOR_TOKEN}`,
        }
    }

    async getDevice(nativeId: string): Promise<any> {
        if (nativeId === 'notify')
            return new NotifyService(this, 'notify');
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
    }

    async sync() {
        const response = await fetch(new URL('services', this.getApiUrl()), {
            headers: this.getHeaders(),
        });
        const json = await response.json() as any[];
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
