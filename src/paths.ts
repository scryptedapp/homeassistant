import fs from 'fs';

export const wwwMediaDirectory = '/media/scrypted/tmp';

fs.promises.rmdir(wwwMediaDirectory, {
    recursive: true,
});


export const scryptedConfigDirectory = '/config/scrypted/tmp';

fs.promises.rmdir(scryptedConfigDirectory, {
    recursive: true,
});

