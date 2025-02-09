import fs from 'fs';

export const wwwDirectory = '/config/www/scrypted/tmp';

export function clearWWWDirectory() {
    fs.promises.rm(wwwDirectory, {
        recursive: true,
        force: true,
    });
}

