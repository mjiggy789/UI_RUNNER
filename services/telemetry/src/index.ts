import express from 'express';
import cors from 'cors';
import { scrub } from './utils';

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.post('/event', (req, res) => {
    const event = req.body;

    const scrubbedEvent = scrub(event);

    console.log('[Telemetry Service] Received Event (Scrubbed):', JSON.stringify(scrubbedEvent, null, 2));

    res.status(202).send(); // Accepted
});

app.listen(port, () => {
    console.log(`Telemetry Service listening at http://localhost:${port}`);
});
