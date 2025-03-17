import { HaDomain, HaEntityData } from "../utils";
import { HaBaseDevice } from "./baseDevice";
import { Lock, LockState } from "@scrypted/sdk";

enum HaLockState {
    Locked = 'locked',
    Unlocked = 'unlocked',
    Jammed = 'jammed',
}

const haToScryptedStateMap: Record<HaLockState, LockState> = {
    [HaLockState.Locked]: LockState.Locked,
    [HaLockState.Unlocked]: LockState.Unlocked,
    [HaLockState.Jammed]: LockState.Jammed,
}

export class HaLock extends HaBaseDevice implements Lock {
    async updateState(entityData: HaEntityData<HaLockState>) {
        const { state } = entityData;

        if (Object.values(HaLockState).includes(state)) {
            this.lockState = haToScryptedStateMap[state];
        }
    }

    async lock(): Promise<void> {
        const response = await this.getActionFn(`services/${HaDomain.Lock}/lock`)();
        this.console.log('Response to lock', response.data);
    }
    async unlock(): Promise<void> {
        const response = await this.getActionFn(`services/${HaDomain.Lock}/unlock`)();
        this.console.log('Response to unlock', response.data);
    }
}