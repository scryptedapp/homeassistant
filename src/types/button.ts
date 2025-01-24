import { HaBaseDevice } from "./baseDevice";
import { Buttons, PressButtons } from "@scrypted/sdk";
import { HaDomain } from "../utils";

export const HaButtonActionButton = 'HaButton';

export class HaButton extends HaBaseDevice implements Buttons, PressButtons {
    buttons = [HaButtonActionButton];

    updateState() {
    }

    async pressButton(button: string): Promise<void> {
        if (button === HaButtonActionButton) {
            await this.getActionFn(`services/${HaDomain.Button}/press`)();
        }
    }
}