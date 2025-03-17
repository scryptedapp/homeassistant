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
        await this.updateState(entityData);
    }

    refreshConfiguration() {
    }

    getActionFn(serviceUrl: string, payload = this.defaultPayload) {
        const actionFn = async () => {
            const url = new URL(serviceUrl, this.plugin.getApiUrl()).toString();
            this.console.log(`Calling HA action: ${JSON.stringify({
                url,
                payload
            })}`);

            return await axios.post(
                url,
                payload,
                {
                    headers: this.plugin.getHeaders(),
                    httpsAgent,
                });
        }


        return actionFn;
    }
}