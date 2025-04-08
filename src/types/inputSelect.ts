import { Sensors, Setting, Settings, SettingValue, TemperatureCommand, TemperatureUnit } from "@scrypted/sdk";
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import type HomeAssistantPlugin from "../main";
import { getSensorType, HaDomain, HaEntityData } from "../utils";
import { HaBaseDevice } from "./baseDevice";

export class HaInputSelect extends HaBaseDevice implements Sensors, Settings {
    storageSettings = new StorageSettings(this, {
        value: {
            title: 'Value',
            type: 'string',
            choices: [],
            immediate: true,
            onPut: (_, newValue) => this.selectOption(newValue)
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

    async selectOption(option: string) {
        await this.getActionFn(`services/${HaDomain.InputSelect}/select_option`, {
            ...this.defaultPayload,
            option,
        });
    }

    async updateState(entityData: HaEntityData) {
        this.storageSettings.settings.value.choices = entityData.attributes.options;
        this.putSetting('value', entityData.state);

        this.sensors = {
            [entityData.entity_id]: {
                name: entityData.attributes.friendly_name,
                value: entityData.state
            }
        };
    }
}