import { HaBaseDevice } from "./baseDevice";
import { Program } from "@scrypted/sdk";
import { HaDomain } from "../utils";

export class HaScript extends HaBaseDevice implements Program {
    async run(variables?: { [name: string]: any; }): Promise<any> {
        const scriptName = this.entity.entity_id.split('.')[1];

        const response = await this.getActionFn(`services/${HaDomain.Script}/${scriptName}`, variables)();
        this.console.log('Response to run', response.data);
    }
}