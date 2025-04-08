import { Sensors, Setting, Settings, SettingValue, TemperatureCommand, TemperatureUnit } from "@scrypted/sdk";
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import type HomeAssistantPlugin from "../main";
import { HaDomain, HaEntityData } from "../utils";
import { HaBaseDevice } from "./baseDevice";

export class HaInputNumber extends HaBaseDevice implements Sensors, Settings {
    storageSettings = new StorageSettings(this, {
        value: {
            title: 'Value',
            type: 'number',
            onPut: (oldValue, newValue) => oldValue !== newValue && this.setValue(newValue)
        },
    });

    constructor(public plugin: HomeAssistantPlugin, nativeId: string, public entity: HaEntityData) {
        super(plugin, nativeId, entity);

        this.updateState(entity);
    }

    async getSettings(): Promise<Setting[]> {
        const settings = await this.storageSettings.getSettings();
        return settings;
    }

    putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }

    async setValue(value: string) {
        await this.getActionFn(`services/${HaDomain.InputNumber}/set_value`, {
            ...this.defaultPayload,
            value,
        });
    }

    async updateState(entityData: HaEntityData) {
        this.putSetting('value', Number(entityData.state));

        this.sensors = {
            [entityData.entity_id]: {
                name: entityData.attributes.friendly_name,
                value: entityData.state
            }
        };
    }
}