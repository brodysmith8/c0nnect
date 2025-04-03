import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Request, Response, Router } from 'express';
import { ChatServerController } from "./ChatServerController.js";
import { MongoInterface } from './MongoInterface.js';

const port = 3000;
const app = express(); 
app.use(cors());
app.use(bodyParser.json()); 

const router = Router();
router.use((req: Request, res: Response, next) => { next() });

// Initialize MongoDB client pool and check connection 
const mongoInterface = new MongoInterface(`mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME}:${process.env.MONGO_INITDB_ROOT_PASSWORD}@mongodb:27017`);
await mongoInterface.dbIsHealthy("Ingress API initialization");
const mongoClient = mongoInterface.client; // Represents a client pool

// Pingable healthcheck endpoint
router.get('/healthcheck', async (req: Request, res: Response) => {
    let dbIsHealthy = await mongoInterface.dbIsHealthy("/api/v1/healthcheck");
    res.send(`c0nnect API server connected. Database is ${dbIsHealthy ? "healthy." : "not healthy!"}`);
});

// Create a new server
router.post('/chatserver', async (req: Request, res: Response) => {
    if (typeof req.body.username === "undefined" || req.body.username === "") res.status(400).send({ message: "Please supply a username." });

    let serverIdObj = await chatServerController.createChatServer(req.body.username);
    if (serverIdObj.serverId === -1) res.status(500).send({ message: "Failed to create ChatServer. Please try again later." });

    // Store some meta about this creation
    else res.send(serverIdObj);
});

// Check if a ChatServer exists
router.get('/chatserver/:serverId', async (req: Request, res: Response) => {
    let serverId = Number.parseInt(req.params.serverId);
    if (Number.isNaN(serverId)) {
        res.status(400).send({ message: "Chat Server ID should be an integer. Try again." });
        return;
    }

    let r = chatServerController.doesChatServerExist(serverId);
    if (!r) res.status(404).send({ chatServerExists: false });
    else res.setHeader("Cache-Control", "no-cache").send({ chatServerExists: true });
}); 

app.use('/api/v1', router);
let httpServer = app.listen(port, () => {
    console.log(`c0nnect API server running on http://localhost:${port}`);
});

// Object to create, manage, and destroy ChatServers. Base HTTP server is Express's
const chatServerController = new ChatServerController();
chatServerController.httpServer = httpServer;
await mongoInterface.dbIsHealthy("ChatServerController initialization"); // Check if DB is healthy first
await chatServerController.setMongoClient(mongoClient, true); // Needs to come after chatServerController.httpServer = ... 