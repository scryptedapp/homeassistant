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
        const response = await this.getActionFn(`services/${HaDomain.Light}/turn_off`)();
        this.console.log('Response to turnOff', response.data);
    }

    async turnOn(): Promise<void> {
        const response = await this.getActionFn(`services/${HaDomain.Light}/turn_on`)();
        this.console.log('Response to turnOn', response.data);
    }
}