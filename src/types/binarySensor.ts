import { BinarySensor } from "@scrypted/sdk";
import { HaBaseDevice } from "./baseDevice";
import { HaEntityData } from "../utils";

enum HaBinarySensorState {
    On = 'on',
    Off = 'off'
}

export class HaBinarySensor extends HaBaseDevice implements BinarySensor {
    async updateState(entityData: HaEntityData<HaBinarySensorState>) {
        const { state } = entityData;

        if (Object.values(HaBinarySensorState).includes(state)) {
            this.binaryState = state === HaBinarySensorState.On;
        }
    }
}