import { HaBaseDevice } from "./baseDevice";
import { PressButtons } from "@scrypted/sdk";
import { HaDomain } from "../utils";

export class HaInputButton extends HaBaseDevice implements PressButtons {
    async pressButton(_: string): Promise<void> {
       await this.getActionFn(`services/${HaDomain.InputButton}/press`);
    }
}