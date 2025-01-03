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
    updateState(entityData: HaEntityData<HaLockState>) {
        const { state } = entityData;

        if (Object.values(HaLockState).includes(state)) {
            this.lockState = haToScryptedStateMap[state];
        }
    }

    lock(): Promise<void> {
        return this.getActionFn(`services/${HaDomain.Lock}/lock`)();
    }
    unlock(): Promise<void> {
        return this.getActionFn(`services/${HaDomain.Lock}/unlock`)();
    }
}