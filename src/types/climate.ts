import { HaDomain, HaEntityData } from "../utils";
import { HaBaseDevice } from "./baseDevice";
import { OnOff, TemperatureCommand, TemperatureSetting, TemperatureUnit, Thermometer, ThermostatMode } from "@scrypted/sdk";

enum HaClimateState {
    Off = 'off',
    Auto = 'auto',
    Cool = 'cool',
    Dry = 'dry',
    FanOnly = 'fan_only',
    HeatCool = 'heat_cool',
    Heat = 'heat',
}

const haToScryptedStateMap: Record<HaClimateState, ThermostatMode> = {
    [HaClimateState.Off]: ThermostatMode.Off,
    [HaClimateState.Auto]: ThermostatMode.Auto,
    [HaClimateState.Cool]: ThermostatMode.Cool,
    [HaClimateState.Dry]: ThermostatMode.Dry,
    [HaClimateState.FanOnly]: ThermostatMode.FanOnly,
    [HaClimateState.HeatCool]: ThermostatMode.HeatCool,
    [HaClimateState.Heat]: ThermostatMode.Heat,
}

const scryptedToHaStateMap: Record<ThermostatMode, HaClimateState> = Object.entries(haToScryptedStateMap).reduce((ret, entry) => {
    const [key, value] = entry;
    ret[value as ThermostatMode] = key as HaClimateState;
    return ret;
}, {} as Record<ThermostatMode, HaClimateState>);

export class HaClimate extends HaBaseDevice implements Thermometer, TemperatureSetting, OnOff {
    turnOff(): Promise<void> {
        return this.getActionFn(`services/${HaDomain.Climate}/turn_off`)();
    }

    turnOn(): Promise<void> {
        return this.getActionFn(`services/${HaDomain.Climate}/turn_on`)();
    }

    setTemperature(command: TemperatureCommand): Promise<void> {
        return this.getActionFn(`services/${HaDomain.Climate}/set_temperature`, {
            ...this.defaultPayload,
            temperature: command.setpoint,
            hvac_mode: command.mode ? scryptedToHaStateMap[command.mode] : undefined,
        })();
    }

    setTemperatureUnit(temperatureUnit: TemperatureUnit): Promise<void> {
        return;
    }

    updateState(entityData: HaEntityData) {
        const { attributes } = entityData;
        this.temperature = attributes.current_temperature;
    }
}