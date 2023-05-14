import fs from 'fs';

export const wwwDirectory = '/config/www/scrypted/tmp';

fs.promises.rmdir(wwwDirectory, {
    recursive: true,
});

