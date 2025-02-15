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

    constructor(public plugin: HomeAssistantPlugin, nativeId: string, public entity: HaEntityData) {
        super(nativeId);
    }

    async updateState(entityData: HaEntityData) {
    }

    refreshConfiguration() {
    }

    getActionFn(serviceUrl: string, payload = this.defaultPayload) {
        const actionFn = async () => {
            await axios.post(
                new URL(serviceUrl, this.plugin.getApiUrl()).toString(),
                payload,
                {
                    headers: this.plugin.getHeaders(),
                    httpsAgent,
                });
        }

        return actionFn;
    }
}