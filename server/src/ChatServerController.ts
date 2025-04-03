// Create WebSocketServers (ChatServers)
import { Server } from "net";
import { Event, WebSocket, WebSocketServer } from "ws";

type ChatServer = WebSocketServer;

class ChatServerController {
    _httpServer?: Server;
    _serverIdToChatServerMap: Map<number, ChatServer> = new Map<number, ChatServer>([]);
    _i = 0;
    
    constructor() {}

    // Dependency injection to add the HTTP server
    set httpServer(server: Server) {
        this._httpServer = server;

        // Select the correct ChatServer based on what serverId is supplied in the URL 
        // https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server 
        this._httpServer.on('upgrade', (request, socket, head) => {
            // Extract serverID out of the provided URL 
            const { pathname } = new URL(request.url, 'ws://localhost:3000/chatserver');
            const serverId = Number.parseInt(pathname.split("/").reverse()[0]);
            
            // If the ChatServer does not exist, or if the serverID doesn't correspond to a real ChatServer,
            // destroy the socket attempting to connect and return early
            if (Number.isNaN(serverId) || typeof this._serverIdToChatServerMap.get(serverId) === "undefined") {
                socket.destroy();
                return;
            }

            // Handle the WebSocket upgrade with this ChatServer, and emit the connection event to 
            // trigger the event listener defined in createChatServer
            const server = this._serverIdToChatServerMap.get(serverId);
            server!.handleUpgrade(request, socket, head, (webSocket) => {
                server!.emit('connection', webSocket, request);
            });
        });
    }
 
    createChatServer(): { serverId: number } {
        if (typeof this._httpServer === "undefined") return { serverId: -1 };
        
        // Sequential serverId generation is not great; should do random hashes instead 
        let serverId = this._i + 1;
        this._i += 1;

        // Create the WebSocketServer for persistent communication 
        const newChatServer = new WebSocketServer({ noServer: true });
        this._serverIdToChatServerMap.set(serverId, newChatServer);
        newChatServer.on('connection', (webSocket: any, request: any) => {
            let dataStr = JSON.stringify({ status: "joined", username: "someone" });
            newChatServer.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) client.send(dataStr); // Relay this message to all the clients
            });
            
            webSocket.on('error', console.error);

            webSocket.on('close', () => {
                console.log(`Client closed connection.`);
                let dataStr = JSON.stringify({ status: "left", username: "someone" });
                newChatServer.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) client.send(dataStr); // Relay this message to all the clients
                });
            });
            
            webSocket.on('message', (data: any) => {
                try {
                    const receivedData = JSON.parse(data);
                    console.log("Data: ", receivedData);
                    console.log("Request: ", request);

                    // TODO: write to DB here 
                    let dataStr = JSON.stringify(receivedData);
                    newChatServer.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) client.send(dataStr); // Relay this message to all the clients
                    });
                } catch (err) {
                    console.error(err);
                    console.log("Error parsing JSON: ", err)
                    console.log("Received data was: ", data)
                }
            });
        });
        
        return { serverId: serverId }
    }

    doesChatServerExist(serverId: number): boolean {
        if (typeof this._serverIdToChatServerMap.get(serverId) === "undefined") return false;
        return true;
    }
}

export { ChatServerController };