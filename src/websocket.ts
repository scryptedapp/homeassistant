import { httpsAgent } from "./main";

const WebSocket = require('ws');

export class HaWebsocket extends WebSocket {
    constructor(address, protocols, options) {
        super(address, protocols, { agent: httpsAgent });
    }
}