import { ScryptedDeviceBase } from '@scrypted/sdk';
import {StorageSettings} from '@scrypted/sdk/storage-settings'
class HomeAssistantPlugin extends ScryptedDeviceBase {
    storageSettings = new StorageSettings(this, {
    });

    constructor(nativeId?: string) {
        super(nativeId);
    }
}

export default HomeAssistantPlugin;
