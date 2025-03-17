import { HaBaseDevice } from "./baseDevice";
import { AudioVolumeControl, AudioVolumes, MediaObject, MediaPlayer, MediaPlayerOptions, MediaStatus, OnOff, Pause } from "@scrypted/sdk";
import { HaDomain, HaEntityData } from "../utils";
import { HaSwitchState } from "./switch";

export class HaMediaPlayer extends HaBaseDevice implements MediaPlayer, OnOff, AudioVolumeControl, Pause {
    async updateState(entityData: HaEntityData<HaSwitchState>) {
        const { state } = entityData;

        if (Object.values(HaSwitchState).includes(state)) {
            this.on = state === HaSwitchState.On;
        }
    }

    async turnOff(): Promise<void> {
        await this.getActionFn(`services/${HaDomain.MediaPlayer}/turn_off`);
    }

    async turnOn(): Promise<void> {
        await this.getActionFn(`services/${HaDomain.MediaPlayer}/turn_on`);
    }

    pause(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    resume(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    setAudioVolumes(audioVolumes: AudioVolumes): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getMediaStatus(): Promise<MediaStatus> {
        throw new Error("Method not implemented.");
    }
    load(media: string | MediaObject, options?: MediaPlayerOptions): Promise<void> {
        throw new Error("Method not implemented.");
    }
    seek(milliseconds: number): Promise<void> {
        throw new Error("Method not implemented.");
    }
    skipNext(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    skipPrevious(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}