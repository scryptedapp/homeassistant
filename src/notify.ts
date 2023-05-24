import sdk, { DeviceProvider, MediaObject, Notifier, NotifierOptions, ScryptedDeviceBase, Setting, SettingValue, Settings } from "@scrypted/sdk";
import HomeAssistantPlugin from "./main";
import fs from 'fs';
import path from 'path';
import { scryptedConfigDirectory, wwwMediaDirectory } from "./paths";
import { StorageSettings } from "@scrypted/sdk/storage-settings";

export class NotifyDevice extends ScryptedDeviceBase implements Notifier, Settings {
    storageSettings = new StorageSettings(this, {
        wwwPath: {
            title: 'Use Config Path',
            description: 'Send attachments using the /config/scrypted file system path. (Telegram, etc)',
            type: 'boolean',
        }
    });

    constructor(public plugin: HomeAssistantPlugin, nativeId: string) {
        super(nativeId);
    }

    async getSettings(): Promise<Setting[]> {
        return this.storageSettings.getSettings();
    }

    async putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }

    async sendNotification(title: string, options?: NotifierOptions, media?: string | MediaObject, icon?: string | MediaObject): Promise<void> {
        let image: string;
        let data: any;

        if (typeof media === 'string') {
            if (media.startsWith('http')) {
                image = media;
                media = undefined;
            }
            else {
                media = await sdk.mediaManager.createMediaObjectFromUrl(media);
            }
        }

        if (media) {
            const jpeg = await sdk.mediaManager.convertMediaObjectToBuffer(media as any, 'image/jpeg');
            const filename = `${Math.random().toString(36)}${Math.random().toString(36)}.jpg`;
            let dstFile: string;
            if (this.storageSettings.values.wwwPath) {
                dstFile = path.join(scryptedConfigDirectory, filename);
                image = dstFile;
            }
            else {
                dstFile = path.join(wwwMediaDirectory, filename);
                image = `/media/local/scrypted/tmp/${filename}`;
            }

            await fs.promises.mkdir(path.dirname(dstFile), {
                recursive: true,
            });
            await fs.promises.writeFile(dstFile, jpeg);
        }

        if (image) {
            data ||= {};
            data.image = image;
        }

        if (options?.data) {
            const { lovelace } = options.data;
            if (lovelace) {
                data ||= {};
                const url = `/lovelace/${lovelace}`;
                data.url = url;
                data.clickAction = url;
            }
        }

        const response = await fetch(new URL(`services/${this.nativeId.replace(':', '/')}`, this.plugin.getApiUrl()), {
            headers: this.plugin.getHeaders(),
            method: 'POST',
            body: JSON.stringify({
                title,
                message: options.body,
                data,
            })
        });

        this.console.log('notification result', response.status, response.statusText);
        const json = await response.json();
        this.console.log('notification sent', json);
    }
}

export class NotifyService extends ScryptedDeviceBase implements DeviceProvider {
    constructor(public plugin: HomeAssistantPlugin, nativeId: string) {
        super(nativeId);
    }

    async getDevice(nativeId: string): Promise<any> {
        return new NotifyDevice(this.plugin, nativeId);
    }
    async releaseDevice(id: string, nativeId: string): Promise<void> {
    }
}
