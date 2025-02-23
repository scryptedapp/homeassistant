import { BinarySensor, EntrySensor } from "@scrypted/sdk";
import { HaBaseDevice } from "./baseDevice";
import { HaEntityData } from "../utils";

enum HaBinarySensorState {
    On = 'on',
    Off = 'off'
}

export class HaBinarySensor extends HaBaseDevice implements BinarySensor, EntrySensor {
    async updateState(entityData: HaEntityData<HaBinarySensorState>) {
        const { state, attributes } = entityData;
        if (attributes && (attributes.device_class === 'door' || attributes.device_class === 'garage' || attributes.device_class === 'garage_door')) {
            this.entryOpen = state === HaBinarySensorState.On;
        } else {
            this.binaryState = state === HaBinarySensorState.On;
        }
    }
}