import { HaBaseDevice } from "./baseDevice";
import { Buttons, OnOff, PressButtons } from "@scrypted/sdk";
import { HaDomain } from "../utils";
import { sleep } from "../../../scrypted/common/src/sleep";

export const HaButtonActionButton = 'HaButton';

export class HaButton extends HaBaseDevice implements Buttons, PressButtons, OnOff {
    buttons = [HaButtonActionButton];

    updateState() {
    }

    async pressButton(button: string): Promise<void> {
        if (button === HaButtonActionButton) {
            await this.getActionFn(`services/${HaDomain.Button}/press`)();
        }
    }

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