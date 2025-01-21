import { HaBaseDevice } from "./baseDevice";
import { OnOff } from "@scrypted/sdk";
import { HaDomain } from "../utils";
import { sleep } from "../../../scrypted/common/src/sleep";

export class HaButton extends HaBaseDevice implements OnOff {
    updateState() { }

    turnOff(): Promise<void> {
        this.on = false;

        return;
    }

    async turnOn(): Promise<void> {
        return new Promise(async (resolve) => {
            this.on = true;

            await this.getActionFn(`services/${HaDomain.Button}/press`)();
            sleep(1000);
            await this.turnOff();

            resolve();
        });
    }
}