import fs from 'fs';

export const wwwDirectory = '/config/www/scrypted/tmp';

export function clearWWWDirectory() {
    fs.promises.rmdir(wwwDirectory, {
        recursive: true,
    });
}

