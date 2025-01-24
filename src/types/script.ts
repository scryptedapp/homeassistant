import { HaBaseDevice } from "./baseDevice";
import { Program } from "@scrypted/sdk";
import { HaDomain } from "../utils";

export class HaScript extends HaBaseDevice implements Program {
    async run(variables?: { [name: string]: any; }): Promise<any> {
        const scriptName = this.entityId.split('.')[1];

        await this.getActionFn(`services/${HaDomain.Script}/${scriptName}`, variables)();
    }
}