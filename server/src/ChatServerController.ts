// Create WebSocketServers (ChatServers)
import { Server } from "net";
import { WebSocket, WebSocketServer } from "ws";
import { MongoClient } from "mongodb";
import { IncomingMessage } from "http";

type ChatServer = WebSocketServer;

class ChatServerController {
    _httpServer?: Server;
    _mongoClient?: MongoClient;
    _serverIdToChatServerMap: Map<number, ChatServer> = new Map<number, ChatServer>([]);
    _websocketToClientUsername: Map<WebSocket, string> = new Map<WebSocket, string>([]);
    _i = 0;
    
    constructor() {}

    // Dependency injection to add the HTTP server
    set httpServer(server: Server) {
        this._httpServer = server;

        // Select the correct ChatServer based on what serverId is supplied in the URL 
        // https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server 
        this._httpServer.on('upgrade', async (request, socket, head) => {
            // Extract serverID and username out of the provided URL 
            const { pathname } = new URL(request.url, 'ws://localhost:3000/chatserver');
            const pathnameSplitReversed = pathname.split("/").reverse();
            const serverId = Number.parseInt(pathnameSplitReversed[1]);

            // If the ChatServer does not exist, or if the serverID doesn't correspond to a real ChatServer, or if username is taken
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

    // Dependency injection to add the MongoClient
    set mongoClient(mongoClient: MongoClient) {
        this._mongoClient = mongoClient;
        this._mongoClient.connect();
    }
 
    async createChatServer(ownerUsername: string): Promise<{ serverId: number }> {
        if (typeof this._httpServer === "undefined") return { serverId: -1 };
        
        // Sequential serverId generation is not great; should do random hashes instead 
        let serverId = this._i + 1;
        this._i += 1;

        // Create relevant DB and entries
        let db = this._mongoClient?.db(`${serverId}`);
        let metainfoCollection = db?.collection("metainfo");
        await metainfoCollection?.insertOne({ username: ownerUsername, owner: true });

        // Create the WebSocketServer for persistent communication 
        const newChatServer = new WebSocketServer({ noServer: true });
        this._serverIdToChatServerMap.set(serverId, newChatServer);
        newChatServer.on('connection', async (webSocket: WebSocket, request: IncomingMessage) => {
            // Extract serverID and username out of the provided URL 
            const { pathname } = new URL(request.url ?? "", 'ws://localhost:3000/chatserver');
            const pathnameSplitReversed = pathname.split("/").reverse();
            const username = pathnameSplitReversed[0];
        
            // Is this person an existing user, or is this username taken? 
            let activeUsersCollection = db?.collection("active_users");
            let existingUser = await activeUsersCollection?.findOne({ username: username });
            let usernameIsTaken = typeof existingUser !== "undefined" && existingUser !== null;
            if (usernameIsTaken) {
                if (webSocket.readyState === WebSocket.OPEN) webSocket.send(JSON.stringify({ message: "Username is taken." }));
                webSocket.close();
                return;
            }

            // Username is not taken, so add them to db and websocket:username map
            await activeUsersCollection?.insertOne({ username: username });
            this._websocketToClientUsername.set(webSocket, username);

            // Tell the others that this person joined
            let dataStr = JSON.stringify({ status: "joined!", username: username });
            newChatServer.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) client.send(dataStr); // Relay this message to all the clients
            });
            
            webSocket.on('error', console.error);

            webSocket.on('close', async () => {
                console.log(`Client closed connection.`);
                let clientUsername = this._websocketToClientUsername.get(webSocket) ?? "someone";
                let dataStr = JSON.stringify({ status: "left.", username: clientUsername });
                await activeUsersCollection?.deleteOne({ username: clientUsername}); // Remove this client from the DB 
                this._websocketToClientUsername.delete(webSocket); // Remove this client from the websocket:username map
                newChatServer.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) client.send(dataStr); // Relay this message to all the clients
                });
            });
            
            webSocket.on('message', async (data: any) => {
                try {
                    let actualUsername = this._websocketToClientUsername.get(webSocket);
                    const receivedData = JSON.parse(data);

                    if (actualUsername !== receivedData.username) {
                        // Impersonation is happening 
                        webSocket.send("Impersonation is against the rules. Closing connection.");
                        webSocket.close();
                        return;
                    }

                    // TODO: write to DB here
                    await db?.collection("messages").insertOne({ username: actualUsername, message: receivedData.message, utc_timestamp: Date.now() });
                    
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