import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.post('/event', (req, res) => {
    const event = req.body;

    // Basic scrubbing (PII removal) - simplified demo
    // In production, check for sensitive fields in event.payload

    console.log('[Telemetry Service] Received Event:', JSON.stringify(event, null, 2));

    res.status(202).send(); // Accepted
});

app.listen(port, () => {
    console.log(`Telemetry Service listening at http://localhost:${port}`);
});
