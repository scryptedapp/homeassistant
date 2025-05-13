import { SecuritySystem, SecuritySystemMode } from "@scrypted/sdk";
import { HaBaseDevice } from "./baseDevice";
import { HaDomain, HaEntityData } from "../utils";

export enum HaAlarmControlPanelState {
    Disarmed = 'disarmed',
    ArmedAway = 'armed_away',
    ArmedHome = 'armed_home',
    ArmedNight = 'armed_night',
    // ArmNight = 'ARM_NIGHT',
    // ArmHome = 'ARM_HOME',
    // ArmAway = 'ARM_AWAY',
    // Disarm = 'DISARM',
}

export const haToScryptedStateMap: Record<HaAlarmControlPanelState, SecuritySystemMode> = {
    [HaAlarmControlPanelState.Disarmed]: SecuritySystemMode.Disarmed,
    [HaAlarmControlPanelState.ArmedAway]: SecuritySystemMode.AwayArmed,
    [HaAlarmControlPanelState.ArmedHome]: SecuritySystemMode.HomeArmed,
    [HaAlarmControlPanelState.ArmedNight]: SecuritySystemMode.NightArmed,
    // [HaAlarmControlPanelState.ArmNight]: SecuritySystemMode.NightArmed,
    // [HaAlarmControlPanelState.ArmHome]: SecuritySystemMode.HomeArmed,
    // [HaAlarmControlPanelState.ArmAway]: SecuritySystemMode.AwayArmed,
    // [HaAlarmControlPanelState.Disarm]: SecuritySystemMode.Disarmed,
}

export const scryptedToHaStateMap: Record<SecuritySystemMode, HaAlarmControlPanelState> = Object.entries(haToScryptedStateMap).reduce((acc, [key, value]) => {
    acc[value as unknown as SecuritySystemMode] = key as HaAlarmControlPanelState;
    return acc;
}, {} as Record<SecuritySystemMode, HaAlarmControlPanelState>);

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

    async armSecuritySystem(mode: SecuritySystemMode): Promise<void> {
        const haMode = scryptedToHaStateMap[mode];
        if (haMode) {
            await this.getActionFn(`services/${HaDomain.AlarmControlPanel}/${haMode}`);
        } else {
            this.console.error('Alarm mode not mapped', mode);
        }
    }

    async disarmSecuritySystem(): Promise<void> {
        await this.getActionFn(`services/${HaDomain.AlarmControlPanel}/${HaAlarmControlPanelState.Disarmed}`);
    }
}