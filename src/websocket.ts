import { httpsAgent } from "./httpsagent";

const WebSocket = require('ws');

export class HaWebsocket extends WebSocket {
    constructor(address, protocols, options) {
        super(address, protocols, { agent: address.startsWith('wss:') ? httpsAgent : undefined });
    }
}

export type AuthData = {
    supervisorToken: string;
};

export class Auth {
    data: AuthData;

    constructor(data: AuthData) {
        this.data = data;
    }

    get wsUrl() {
        return 'ws://supervisor/core/websocket';
    }

    get accessToken() {
        return this.data.supervisorToken;
    }

    get expired() {
        return false;
    }

    async refreshAccessToken() {
        // No-op
    }
}