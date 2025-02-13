import { ScryptedDeviceBase, Sensors } from "@scrypted/sdk";
import axios from "axios";
import { httpsAgent } from "../httpsagent";
import HomeAssistantPlugin from "../main";
import { HaEntityData } from "../utils";

export class HaSensors extends ScryptedDeviceBase implements Sensors {
    agent = httpsAgent;
    constructor(
        public plugin: HomeAssistantPlugin,
        nativeId: string,
        public entities: HaEntityData[]
    ) {
        super(nativeId);
    }

    getActionFn(serviceUrl: string, payload) {
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