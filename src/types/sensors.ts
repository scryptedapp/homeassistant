import { Settings, Sensors, Setting, SettingValue, ScryptedInterface, Sensor } from "@scrypted/sdk";
import HomeAssistantPlugin from "../main";
import { HaEntityData } from "../utils";
import { HaBaseDevice } from "./baseDevice";
import { UnitConverter } from "../unitConverter";
import { StorageSettings } from "@scrypted/sdk/storage-settings";

export class HaSensors extends HaBaseDevice implements Sensors, Settings {
    storageSettings = new StorageSettings(this, {});

    constructor(
        public plugin: HomeAssistantPlugin,
        nativeId: string,
        public entities: HaEntityData[],
    ) {
        super(plugin, nativeId, undefined);
    }

    async getSettings(): Promise<Setting[]> {
        const settings = await this.storageSettings.getSettings();

        for (const sensor of Object.entries(this.sensors)) {
            const [entityId, { name, unit, value }] = sensor;
            let textValue = value;

            if (unit) {
                textValue += ` (${unit})`;
            }

            settings.push({
                key: entityId,
                title: `${name} (${entityId})`,
                type: 'string',
                readonly: true,
                value: textValue
            });
        }

        return settings;
    }

    putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }

    async updateState(entityData: HaEntityData) {
        try {
            if (!this.sensors) {
                this.sensors = {};
            }

            const { state, entity_id, attributes: { unit_of_measurement, friendly_name } } = entityData;

            const unit = unit_of_measurement ? UnitConverter.getUnit(unit_of_measurement)?.unit : undefined;
            const numericValue = Number(state);

            let value = state;

            if (!Number.isNaN(numericValue)) {
                value = UnitConverter.localToSi(numericValue, unit);
            }

            const updatedSensorData: Sensor = {
                name: friendly_name,
                unit,
                value
            };

            const currentValue = this.sensors[entity_id];
            if (currentValue?.value !== value) {
                this.sensors = {
                    ...this.sensors,
                    [entity_id]: updatedSensorData
                };

                await this.onDeviceEvent(entity_id, updatedSensorData);
            }
        } catch (e) {
            this.console.error(`Error during updateState: ${JSON.stringify({
                entityData,
                nativeId: this.nativeId,
                entity: this.entity
            })}`, e);
        }
    }
}