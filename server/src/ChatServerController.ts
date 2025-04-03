/*
Create and manage WebSocketServers (ChatServers).


[1] WebSocket package object documentation: https://github.com/websockets/ws/blob/HEAD/doc/ws.md 
[2] WebSocket package tutorial: https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server  
*/
import { Server } from "net";
import { WebSocket, WebSocketServer } from "ws";
import { MongoClient } from "mongodb";
import { IncomingMessage } from "http";

const ACTIVE_USER_COLLECTION_NAME = "active_users";
const METAINFO_COLLECTION_NAME = "metainfo";
const MESSAGES_COLLECTION_NAME = "messages";

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

        // Select the correct ChatServer based on what serverId is supplied in the URL [2]
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

    // Dependency injection to add the MongoClient. Also, check for existing ChatServers and restore their state 
    async setMongoClient(mongoClient: MongoClient, restoreServers: boolean = true) {
        this._mongoClient = mongoClient;
        await this._mongoClient.connect();

        // Check for existing ChatServer databases, while ignoring the default DBs 
        let dbNames = (await this._mongoClient.db().admin().listDatabases()).databases
            .filter((db) => (db.name !== "admin" && db.name !== "config" && db.name !== "local"))
            .map((dbObj) => dbObj.name);
        
        // Clear all DBs
        if (!this._httpServer || !restoreServers) { 
            dbNames.map(async (dbName) => {
                // Have to do this cast to unknown -> MongoClient because TypeScript can't recognize thisArg from .map()
                await this._mongoClient?.db(dbName).dropDatabase(); 
            }, this);
            return; 
        }

        // Otherwise, restore the ChatServers
        let maxServerId = 0;
        dbNames.map(async (dbName) => {
            let serverId = Number.parseInt(dbName);
            if (Number.isNaN(serverId)) {
                console.error("ServerID is NaN.");
                console.log("ServerID: ", dbName);
                return;
            }
            let ownerUsername = (await this._mongoClient?.db(dbName).collection(METAINFO_COLLECTION_NAME).findOne({ owner: true }))?.username;
            this._i = serverId - 1;
            if (serverId > maxServerId) maxServerId = serverId;
            await this.createChatServer(ownerUsername);
        }, this);
        this._i = maxServerId; // Restore the old server ID for sequential ordering
    }
 
    async createChatServer(ownerUsername: string): Promise<{ serverId: number }> {
        if (typeof this._httpServer === "undefined") return { serverId: -1 };
        
        // Sequential serverId generation is not great; should do random hashes instead 
        let serverId = this._i + 1;
        this._i += 1;

        // Create relevant DB and entries
        let db = this._mongoClient?.db(`${serverId}`);
        let metainfoCollection = db?.collection(METAINFO_COLLECTION_NAME);
        await metainfoCollection?.replaceOne({ username: ownerUsername, owner: true }, { username: ownerUsername, owner: true }, { upsert: true }); // Replace if exists, add if not

        // Create the WebSocketServer for persistent communication 
        const newChatServer = new WebSocketServer({ noServer: true });
        this._serverIdToChatServerMap.set(serverId, newChatServer);
        newChatServer.on('connection', async (webSocket: WebSocket, request: IncomingMessage) => {
            // Extract serverID and username out of the provided URL 
            const { pathname } = new URL(request.url ?? "", 'ws://localhost:3000/chatserver');
            const pathnameSplitReversed = pathname.split("/").reverse();
            const username = pathnameSplitReversed[0];
        
            // Is this person an existing user, or is this username taken? 
            let activeUsersCollection = db?.collection(ACTIVE_USER_COLLECTION_NAME);
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

            // Get the message history for this server, sorted in chronological order
            let chatHistory = await (db?.collection(MESSAGES_COLLECTION_NAME).find({}).sort({ utc_timestamp: 1 }))?.toArray();

            // Get the active users if this server has any
            let activeUsers = await (db?.collection(ACTIVE_USER_COLLECTION_NAME).find({}))?.toArray();

            // Tell the others that this person joined, and send this person the chat history + current active user list 
            let dataObjJoiningClient: any = { status: "joined!", username: username };
            let dataObjEveryoneElse: any = { status: "joined!", username: username };
            if (chatHistory) {
                dataObjJoiningClient.chatHistory = chatHistory;
            } 
            if (activeUsers) {
                dataObjJoiningClient.activeUsers = activeUsers;
            }

            let dataObjJoiningClientStringified = JSON.stringify(dataObjJoiningClient);
            let dataObjEveryoneElseStringified = JSON.stringify(dataObjEveryoneElse);
            newChatServer.clients.forEach((client) => {
                if (client.readyState !== WebSocket.OPEN) return;
                
                if (client === webSocket) client.send(dataObjJoiningClientStringified) 
                else client.send(dataObjEveryoneElseStringified); // Relay this message to all the clients
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
                    await db?.collection(MESSAGES_COLLECTION_NAME).insertOne({ username: actualUsername, message: receivedData.message, utc_timestamp: Date.now() });
                    
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