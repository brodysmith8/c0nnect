import { MongoClient, ServerApiVersion } from "mongodb";

// Interface to the MongoDB database
// https://www.mongodb.com/docs/drivers/node/current/fundamentals/connection/connect/ 
class MongoInterface {
    _client: MongoClient; // Represents a pool of connections 
    
    constructor(connectionUri: string) {
        this._client = new MongoClient(connectionUri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true
            }
        });
    }

    get client() {
        return this._client;
    }

    // Ping the database to see if it works. For normal CRUD operations, 
    // the MongoDB driver automatically connects, so we don't have to do this each time.
    async dbIsHealthy(stage?: string): Promise<boolean> {
        let res = true;
        try {
            await this._client.connect();
            await this._client.db("admin").command({ ping: 1 });
        } catch (err) {
            console.log(`Database failed connection${(stage && stage !== null) ? ` at stage ${stage}` : ""}.`);
            console.error(err);
            res = false;
        } finally {
            await this._client.close();
        }
        return res; 
    }
}

export { MongoInterface }