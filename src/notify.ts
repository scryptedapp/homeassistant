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
        let data: any = {
            priority: 'high',
            channel: 'scrypted'
        };

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
            let tryCloud = !process.env.SUPERVISOR_TOKEN;
            if (!tryCloud) {
                try {
                    const jpeg = await sdk.mediaManager.convertMediaObjectToBuffer(media as any, 'image/jpeg');
                    await fs.promises.mkdir(wwwDirectory, {
                        recursive: true,
                    });
                    const filename = `${Math.random().toString(36)}${Math.random().toString(36)}.jpg`;
                    await fs.promises.writeFile(path.join(wwwDirectory, filename), jpeg);
                    image = `/local/scrypted/tmp/${filename}`
                }
                catch (e) {
                    tryCloud = true;
                    this.console.error('Error creating local URL for image. Is the Supervisor token set?', e);
                }
            }

            if (tryCloud) {
                try {
                    image = await sdk.mediaManager.convertMediaObjectToUrl(media, 'image/jpeg');
                }
                catch (e) {
                    this.console.error('Error creating external URL for image. Is the Scrypted Cloud plugin installed?', e);
                }
            }
        }

        if (image)
            data.image = image;

         // Append the channel to the default 'scrypted' channel, if specified
        if (options?.channel && options?.channel.length > 0)
            data.channel += "_" + options.channel

        if (options?.data?.ha)
            Object.assign(data, options.data.ha)

        this.console.log('ha notification payload', data);

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
