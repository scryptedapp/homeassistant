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
        }
    });

    async getSettings() {
        const settings: Setting[] = await this.storageSettings.getSettings();

        return settings;
    }

    putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }

    async updateState(entityData: HaEntityData<HaCoverState>) {
        const { allowStop } = this.storageSettings.values;
        const { attributes, state } = entityData;
        this.coverState = state;

        if (allowStop) {
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

    async openEntry(): Promise<void> {
        const { allowStop } = this.storageSettings.values;

        if (allowStop) {
            if (this.coverState === HaCoverState.Closing) {
                this.console.log(`Stopping because opening and current state is ${this.coverState}`);
                this.coverState = HaCoverState.Open;
                await this.getActionFn(`services/${HaDomain.Cover}/stop_cover`);
            } else {
                this.console.log(`Opening because opening and current state is ${this.coverState}`);
                this.coverState = HaCoverState.Opening;
                await this.getActionFn(`services/${HaDomain.Cover}/open_cover`);
            }
        } else {
            await this.getActionFn(`services/${HaDomain.Cover}/open_cover`);
        }
    }

    async closeEntry(): Promise<void> {
        const { allowStop } = this.storageSettings.values;

        if (allowStop) {
            if (this.coverState === HaCoverState.Opening) {
                this.console.log(`Stopping because closing and current state is ${this.coverState}`);
                this.coverState = HaCoverState.Open;
                await this.getActionFn(`services/${HaDomain.Cover}/stop_cover`);
            } else {
                this.console.log(`Stopping because closing and current state is ${this.coverState}`);
                this.coverState = HaCoverState.Closing;
                await this.getActionFn(`services/${HaDomain.Cover}/close_cover`);
            }
        } else {
            await this.getActionFn(`services/${HaDomain.Cover}/close_cover`);
        }
    }
}