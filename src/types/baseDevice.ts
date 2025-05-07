import { ScryptedDeviceBase } from "@scrypted/sdk";
import type HomeAssistantPlugin from "../main";
import axios from "axios";
import { HaEntityData } from "../utils";
import { httpsAgent } from "../httpsagent";

export class HaBaseDevice extends ScryptedDeviceBase {
    agent = httpsAgent;
    defaultPayload: object = this.entity ? {
        entity_id: this.entity.entity_id
    } : undefined;
    lastUpdate: number;

    constructor(public plugin: HomeAssistantPlugin, nativeId: string, public entity: HaEntityData) {
        super(nativeId);
    }

    async updateState(entityData: HaEntityData) {
    }

    async updateStateParent(entityData: HaEntityData) {
        if (this.plugin.storageSettings.values.debug) {
            this.console.log(`Update entity ${entityData.entity_id}: ${JSON.stringify(entityData)}`);
        }
        this.lastUpdate = Date.now();

        await this.updateState(entityData);
    }

    refreshConfiguration() {
    }

    async getActionFn(serviceUrl: string, payload = this.defaultPayload) {
        const url = new URL(serviceUrl, this.plugin.getApiUrl()).toString();
        this.console.log(`Calling HA action: ${JSON.stringify({
            url,
            payload
        })}`);

        const response = await axios.post(
            url,
            payload,
            {
                headers: this.plugin.getHeaders(),
                httpsAgent,
            });

        this.console.log(`Response to ${serviceUrl.split('/').pop()}`, response.data);
    }
}