import { OnOff } from "@scrypted/sdk";
import { HaDomain, HaEntityData } from "../utils";
import { HaBaseDevice } from "./baseDevice";
import { HaSwitchState } from "./switch";

export class HaInputBoolean extends HaBaseDevice implements OnOff {
    async updateState(entityData: HaEntityData<HaSwitchState>) {
        const { state } = entityData;

        if (Object.values(HaSwitchState).includes(state)) {
            this.on = state === HaSwitchState.On;
        }
    }

    async turnOff(): Promise<void> {
        this.on = false;
        await this.getActionFn(`services/${HaDomain.InputBoolean}/turn_off`);
    }

    async turnOn(): Promise<void> {
        this.on = true;
        await this.getActionFn(`services/${HaDomain.InputBoolean}/turn_on`);
    }
}