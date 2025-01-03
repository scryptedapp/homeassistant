import { httpsAgent } from "./httpsagent";

const WebSocket = require('ws');

export class HaWebsocket extends WebSocket {
    constructor(address, protocols, options) {
        super(address, protocols, { agent: address.startsWith('https:') ? httpsAgent : undefined });
    }
}