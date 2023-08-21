import sdk, { DeviceProvider, MediaObject, Notifier, NotifierOptions, ScryptedDeviceBase } from "@scrypted/sdk";
import HomeAssistantPlugin from "./main";
import fs from 'fs';
import path from 'path';
import { wwwDirectory } from "./www";

export class NotifyDevice extends ScryptedDeviceBase implements Notifier {
    constructor(public plugin: HomeAssistantPlugin, nativeId: string) {
        super(nativeId);
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
            if (process.env.SUPERVISOR_TOKEN) {
                const jpeg = await sdk.mediaManager.convertMediaObjectToBuffer(media as any, 'image/jpeg');
                await fs.promises.mkdir(wwwDirectory, {
                    recursive: true,
                });
                const filename = `${Math.random().toString(36)}${Math.random().toString(36)}.jpg`;
                await fs.promises.writeFile(path.join(wwwDirectory, filename), jpeg);
                image = `/local/scrypted/tmp/${filename}`
            }
            else {
                image = await sdk.mediaManager.convertMediaObjectToUrl(media, 'image/jpeg');
            }
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
