import { ScryptedDeviceBase } from "@scrypted/sdk";
import HomeAssistantPlugin, { httpsAgent } from "../main";
import axios from "axios";
import { HaEntityData } from "../utils";

export class HaBaseDevice extends ScryptedDeviceBase {
    agent = httpsAgent;
    defaultPayload: object = {
        entity_id: this.entityId
    };

    constructor(public plugin: HomeAssistantPlugin, nativeId: string, public entityId: string) {
        super(nativeId);

        this.plugin.deviceMap[entityId] = this;
    }

    updateState(entityData: HaEntityData) {
        throw new Error("Method not implemented.");
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