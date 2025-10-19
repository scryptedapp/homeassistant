import { BinarySensor, EntrySensor, FloodSensor, MotionSensor, ScryptedDeviceBase } from "@scrypted/sdk";
import { HaBaseDevice } from "./baseDevice";
import { getBinarySensorType, HaEntityData } from "../utils";

export enum HaBinarySensorState {
    On = 'on',
    Off = 'off'
}

export class HaBinarySensor extends HaBaseDevice implements BinarySensor, EntrySensor, FloodSensor, MotionSensor {
    async updateState(entityData: HaEntityData<HaBinarySensorState>) {
        const { state } = entityData;
        const { isFLoodSensor, isDoorSensor, isMotionSensor } = getBinarySensorType(entityData);

        const newState = state === HaBinarySensorState.On ? true :
            state === HaBinarySensorState.Off ? false :
                undefined;

        const key: keyof ScryptedDeviceBase = isFLoodSensor ? 'flooded' :
            isDoorSensor ? 'entryOpen' :
            isMotionSensor ? 'motionDetected' :
                'binaryState'

        const currentState = this[key];
        if (newState !== undefined && currentState !== newState) {
            this[key] = newState;
            this.binaryState = newState;
        }
    }
}