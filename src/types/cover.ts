import { StorageSettings } from "@scrypted/sdk/storage-settings";
import { HaDomain, HaEntityData } from "../utils";
import { HaBaseDevice } from "./baseDevice";
import { Entry, EntrySensor, Setting, SettingValue, Settings } from "@scrypted/sdk";

enum HaCoverState {
    Open = 'open',
    Opening = 'opening',
    Closing = 'closing',
    Closed = 'closed',
    Unavailable = 'unavailable',
    Unknown = 'unknown',
}

export class HaCover extends HaBaseDevice implements Entry, EntrySensor, Settings {
    coverState: HaCoverState;
    storageSettings = new StorageSettings(this, {
        allowStop: {
            title: 'Allow stop',
            description: 'Stop the cover if moving and pressing the opposite direction',
            type: 'boolean',
            immediate: true,
            defaultValue: true
        },
    });

    async getSettings() {
        const settings: Setting[] = await this.storageSettings.getSettings();

        return settings;
    }

    putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }

    async updateState(entityData: HaEntityData<HaCoverState>) {
        const { attributes, state } = entityData;
        this.coverState = state;

        if (this.storageSettings.values.allowStop) {
            if (state === HaCoverState.Closing) {
                this.entryOpen = false;
            } else if (state === HaCoverState.Opening) {
                this.entryOpen = true;
            } else {
                this.entryOpen = attributes.current_position > 0;
            }
        } else {
            this.entryOpen = attributes.current_position > 0;
        }
    }

    openEntry(): Promise<void> {
        if (this.storageSettings.values.allowStop && this.coverState === HaCoverState.Closing) {
            return this.getActionFn(`services/${HaDomain.Cover}/stop_cover`)();
        } else {
            return this.getActionFn(`services/${HaDomain.Cover}/open_cover`)();
        }
    }

    closeEntry(): Promise<void> {
        if (this.storageSettings.values.allowStop && this.coverState === HaCoverState.Opening) {
            return this.getActionFn(`services/${HaDomain.Cover}/stop_cover`)();
        } else {
            return this.getActionFn(`services/${HaDomain.Cover}/close_cover`)();
        }
    }
}