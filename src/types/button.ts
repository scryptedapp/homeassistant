import { HaBaseDevice } from "./baseDevice";
import { PressButtons } from "@scrypted/sdk";
import { HaDomain } from "../utils";

export class HaButton extends HaBaseDevice implements PressButtons {
    async pressButton(_: string): Promise<void> {
        const response = await this.getActionFn(`services/${HaDomain.Button}/press`)();
        this.console.log('Response to pressButton', response.data);
    }
}