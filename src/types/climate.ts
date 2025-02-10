import { getSensorType, HaDomain, HaEntityData } from "../utils";
import { HaBaseDevice } from "./baseDevice";
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import type HomeAssistantPlugin from "../main";
import { OnOff, TemperatureCommand, TemperatureSetting, TemperatureUnit, Thermometer, ThermostatMode, Settings, Setting, SettingValue } from "@scrypted/sdk";

enum HaClimateState {
    Off = 'off',
    Auto = 'auto',
    Cool = 'cool',
    Dry = 'dry',
    FanOnly = 'fan_only',
    HeatCool = 'heat_cool',
    Heat = 'heat',
}

enum HomeassistantTemperatureUnit {
    C = '°C',
    F = '°F',
}

const haToScryptedUnit: Record<HomeassistantTemperatureUnit, TemperatureUnit> = {
    [HomeassistantTemperatureUnit.C]: TemperatureUnit.C,
    [HomeassistantTemperatureUnit.F]: TemperatureUnit.F,
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

export class HaClimate extends HaBaseDevice implements Thermometer, TemperatureSetting, OnOff, Settings {
    storageSettings = new StorageSettings(this, {
        unit: {
            title: 'Unit',
            choices: [TemperatureUnit.C, TemperatureUnit.F],
            defaultValue: TemperatureUnit.C,
            onPut: (_, newValue) => this.temperatureUnit = newValue
        },
    });

    constructor(public plugin: HomeAssistantPlugin, nativeId: string, public entity: HaEntityData) {
        super(plugin, nativeId, entity);

        if (entity.attributes.unit_of_measurement) {
            this.temperatureUnit = haToScryptedUnit[entity.attributes.unit_of_measurement];
            this.storageSettings.values.unit = this.temperatureUnit;
        } else {
            this.temperatureUnit = this.storageSettings.values.unit;
        }
    }

    async getSettings(): Promise<Setting[]> {
        const settings = await this.storageSettings.getSettings();
        return settings;
    }

    putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }

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

    convertTemperature(temperature: string | number | undefined, unit: string) {
        if (temperature === undefined) {
            return undefined;
        }

        const temperatureNumber = Number(temperature);
        if (unit === HomeassistantTemperatureUnit.F) {
            return (temperatureNumber - 32) / 1.8;
        } else {
            return temperatureNumber;
        }
    }

    updateState(entityData: HaEntityData) {
        const { attributes, state } = entityData;
        const { isHumiditySensor, isTemperatureSensor } = getSensorType(entityData);
        if (entityData.entity_id.startsWith('climate.')) {
            this.temperature = this.convertTemperature(entityData.state, entityData.attributes.unit_of_measurement);
        } else if (isHumiditySensor) {
            this.humidity = state ? Number(state) : undefined
        } else if (isTemperatureSensor) {
            this.temperature = this.convertTemperature(entityData.state, entityData.attributes.unit_of_measurement);
        }
    }
}