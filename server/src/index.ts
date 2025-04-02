import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Request, Response, Router } from 'express';

const port = 3000;
const app = express(); 
app.use(cors());
app.use(bodyParser.json()); 

const router = Router();
router.use((req: Request, res: Response, next) => { next() });

router.get('/healthcheck', (req: Request, res: Response) => {
    res.send('LTD DITS Connected');
});

app.use('/api/v1', router);
app.listen(port, () => {
    console.log(`DITS server running on http://localhost:${port}`);
});