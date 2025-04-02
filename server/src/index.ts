import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Request, Response, Router } from 'express';
import { ChatServerFactory } from './ChatServerFactory';

const port = 3000;
const app = express(); 
app.use(cors());
app.use(bodyParser.json()); 

const router = Router();
router.use((req: Request, res: Response, next) => { next() });

// Pingable healthcheck endpoint
router.get('/healthcheck', (req: Request, res: Response) => {
    res.send('c0nnect API server connected');
});

// Create a new server
const chatServerFactory = new ChatServerFactory();
router.post('/chatserver', async (req: Request, res: Response) => {
    let serverIdObj = chatServerFactory.createChatServer();
    if (serverIdObj.serverId === -1) res.status(500).send({ message:"Failed to create ChatServer. Please try again later." });
    else res.send(serverIdObj);
});

app.use('/api/v1', router);
let httpServer = app.listen(port, () => {
    console.log(`c0nnect API server running on http://localhost:${port}`);
});

// Give the chatServerFactory the server so it can make WebSocketServers with it
chatServerFactory.httpServer = httpServer;