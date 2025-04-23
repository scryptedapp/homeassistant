import { BinarySensor, EntrySensor, FloodSensor } from "@scrypted/sdk";
import { HaBaseDevice } from "./baseDevice";
import { getBinarySensorType, HaEntityData } from "../utils";

export enum HaBinarySensorState {
    On = 'on',
    Off = 'off'
}

export class HaBinarySensor extends HaBaseDevice implements BinarySensor, EntrySensor, FloodSensor {
    async updateState(entityData: HaEntityData<HaBinarySensorState>) {
        const { state } = entityData;
        const { isFLoodSensor, isDoorSensor } = getBinarySensorType(entityData);

        if (isFLoodSensor) {
            this.flooded = state === HaBinarySensorState.On;
        } else if (isDoorSensor) {
            this.entryOpen = state === HaBinarySensorState.On;
        } else {
            this.binaryState = state === HaBinarySensorState.On;
        }
    }
}