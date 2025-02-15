import { SecuritySystem, SecuritySystemMode } from "@scrypted/sdk";
import { HaBaseDevice } from "./baseDevice";
import { HaEntityData } from "../utils";

enum HaAlarmControlPanelState {
    Disarmed = 'disarmed',
    ArmedAway = 'armed_away',
    ArmedHome = 'armed_home',
    ArmedNight = 'armed_night',
}

const haToScryptedStateMap: Record<HaAlarmControlPanelState, SecuritySystemMode> = {
    [HaAlarmControlPanelState.Disarmed]: SecuritySystemMode.Disarmed,
    [HaAlarmControlPanelState.ArmedAway]: SecuritySystemMode.AwayArmed,
    [HaAlarmControlPanelState.ArmedHome]: SecuritySystemMode.HomeArmed,
    [HaAlarmControlPanelState.ArmedNight]: SecuritySystemMode.NightArmed,
}

export class HaSecuritySystem extends HaBaseDevice implements SecuritySystem {
    async updateState(entityData: HaEntityData<HaAlarmControlPanelState>) {
        const { state } = entityData;

        if (Object.values(HaAlarmControlPanelState).includes(state)) {
            this.securitySystemState = {
                mode: haToScryptedStateMap[state],
                supportedModes: Object.values(SecuritySystemMode)
            }
        }
    }

    armSecuritySystem(mode: SecuritySystemMode): Promise<void> {
        throw new Error("Method not implemented.");
    }

    disarmSecuritySystem(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}