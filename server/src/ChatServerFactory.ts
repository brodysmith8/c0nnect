// Create WebSocketServers (ChatServers)
import { Server } from "net";
import { WebSocketServer } from "ws";

type ChatServer = WebSocketServer;

class ChatServerFactory {
    _httpServer?: Server;
    _pathNameToChatServer: Map<number, ChatServer> = new Map<number, ChatServer>([]);
    _i = 0;

    constructor() {}

    // Dependency injection to add the HTTP server
    set httpServer(server: Server) {
        this._httpServer = server;
        console.log("Server set");

        // Select the correct ChatServer based on what serverId is supplied in the URL 
        // https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server 
        this._httpServer.on('upgrade', (request, socket, head) => {
            // Extract serverID out of the provided URL 
            console.log(`request url: ${request.url}`);
            const { pathname } = new URL(request.url, 'ws://localhost:3000/chatserver');
            const serverId = Number.parseInt(pathname.split("/").reverse()[0]);
            
            // If the ChatServer does not exist, or if the serverID doesn't correspond to a real ChatServer,
            // destroy the socket attempting to connect and return early
            if (Number.isNaN(serverId) || typeof this._pathNameToChatServer.get(serverId) === "undefined") {
                socket.destroy();
                return;
            }

            // Handle the WebSocket upgrade with this ChatServer, and emit the connection event to 
            // trigger the event listener defined in createChatServer
            const server = this._pathNameToChatServer.get(serverId);
            server!.handleUpgrade(request, socket, head, (ws) => {
                server!.emit('connection', ws, request);
            });
        });
    }
 
    createChatServer() {
        if (typeof this._httpServer === "undefined") return { serverId: -1 };
        
        // Sequential serverId generation is not great; should do random hashes instead 
        let h = this._i + 1;
        this._i += 1;

        // Create the WebSocketServer for persistent communication 
        const newChatServer = new WebSocketServer({ noServer: true });
        newChatServer.on('connection', function connection(webSocket) {
            webSocket.on('error', console.error);
            console.log(`${h}: new connection ${webSocket}`);
        });

        this._pathNameToChatServer.set(h, newChatServer);
        return { serverId: h }
    }
}

export { ChatServerFactory };