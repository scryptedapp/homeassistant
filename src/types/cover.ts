import { HaDomain } from "../utils";
import { HaBaseDevice } from "./baseDevice";
import { Entry } from "@scrypted/sdk";

export class HaCover extends HaBaseDevice implements Entry {
    updateState() {
    }

    openEntry(): Promise<void> {
        return this.getActionFn(`services/${HaDomain.Cover}/open_cover`)();
    }

    closeEntry(): Promise<void> {
        return this.getActionFn(`services/${HaDomain.Cover}/close_cover`)();
    }
}