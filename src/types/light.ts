import { HaBaseDevice } from "./baseDevice";
import { OnOff } from "@scrypted/sdk";
import { HaDomain, HaEntityData } from "../utils";

enum HaLightState {
    On = 'on',
    Off = 'off'
}

export class HaLight extends HaBaseDevice implements OnOff {
    async updateState(entityData: HaEntityData<HaLightState>) {
        const { state } = entityData;

        if (Object.values(HaLightState).includes(state)) {
            this.on = state === HaLightState.On;
        }
    }

    async turnOff(): Promise<void> {
        await this.getActionFn(`services/${HaDomain.Light}/turn_off`);
    }

    async turnOn(): Promise<void> {
        await this.getActionFn(`services/${HaDomain.Light}/turn_on`);
    }
}