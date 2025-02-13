import sdk, { DeviceProvider, MediaObject, Notifier, NotifierOptions, ScryptedDeviceBase } from "@scrypted/sdk";
import type HomeAssistantPlugin from "./main";
import fs from 'fs';
import path from 'path';
import { wwwDirectory } from "./www";
import axios from "axios";
import { httpsAgent } from "./httpsagent";

export class NotifyDevice extends ScryptedDeviceBase implements Notifier {
    constructor(public plugin: HomeAssistantPlugin, nativeId: string) {
        super(nativeId);
    }

    async sendNotification(title: string, options?: NotifierOptions, media?: string | MediaObject, icon?: string | MediaObject): Promise<void> {
        let image: string;
        let data: any = {
            priority: 'high',
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
        data.channel = 'scrypted'
        if (options?.android?.channel && options?.android?.channel.length > 0)
            data.channel += "_" + options.android.channel

        if (options?.data?.ha)
            Object.assign(data, options.data.ha);

        this.console.log('ha notification payload', data);

        if (options?.critical) {
            data.push ||= {};
            data.push['interruption-level'] = 'critical';
        }

        const response = await axios.post(new URL(`services/${this.nativeId.replace(':', '/')}`, this.plugin.getApiUrl()).toString(),
            {
                title,
                message: options?.body || '',
                data,
            },
            {
                responseType: 'json',
                headers: this.plugin.getHeaders(),
                httpsAgent,
            }
        );

        this.console.log('notification result', response.status, response.statusText);
        this.console.log('notification sent', response.data);
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
