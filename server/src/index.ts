import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Request, Response, Router } from 'express';
import { ChatServerController } from './ChatServerController';

const port = 3000;
const app = express(); 
app.use(cors());
app.use(bodyParser.json()); 

const router = Router();
router.use((req: Request, res: Response, next) => { next() });

// Object to create, manage, and destroy ChatServers
const chatServerController = new ChatServerController();

// Pingable healthcheck endpoint
router.get('/healthcheck', (req: Request, res: Response) => {
    res.send('c0nnect API server connected');
});

// Create a new server
router.post('/chatserver', async (req: Request, res: Response) => {
    let serverIdObj = chatServerController.createChatServer();
    if (serverIdObj.serverId === -1) res.status(500).send({ message: "Failed to create ChatServer. Please try again later." });
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

// Give the chatServerFactory the server so it can make WebSocketServers with it
chatServerController.httpServer = httpServer;