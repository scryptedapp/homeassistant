import { HaBaseDevice } from "./baseDevice";
import { OnOff } from "@scrypted/sdk";
import { HaDomain, HaEntityData } from "../utils";

export enum HaSwitchState {
    On = 'on',
    Off = 'off'
}

export class HaSwitch extends HaBaseDevice implements OnOff {
    async updateState(entityData: HaEntityData<HaSwitchState>) {
        const { state } = entityData;

        if (Object.values(HaSwitchState).includes(state)) {
            this.on = state === HaSwitchState.On;
        }
    }

    async turnOff(): Promise<void> {
        await this.getActionFn(`services/${HaDomain.Switch}/turn_off`);
    }

    async turnOn(): Promise<void> {
        await this.getActionFn(`services/${HaDomain.Switch}/turn_on`);
    }
}