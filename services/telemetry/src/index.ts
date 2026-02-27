import express from 'express';
import cors from 'cors';

const app = express();
const port = Number(process.env.PORT || 4010);
const MAX_EVENTS = Number(process.env.MAX_EVENTS || 1500);
const LOG_TO_CONSOLE = process.env.LOG_TO_CONSOLE === '1';

type TelemetryEvent = {
    type?: string;
    payload?: Record<string, unknown>;
    timestamp?: number;
    receivedAt: number;
};

const events: TelemetryEvent[] = [];

app.use(cors());
app.use(express.json());

app.post('/event', (req, res) => {
    const incoming = req.body ?? {};
    const event: TelemetryEvent = {
        type: incoming.type,
        payload: incoming.payload,
        timestamp: incoming.timestamp,
        receivedAt: Date.now()
    };
    events.push(event);
    if (events.length > MAX_EVENTS) {
        events.splice(0, events.length - MAX_EVENTS);
    }

    if (LOG_TO_CONSOLE) {
        console.log('[Telemetry Service] Received Event:', JSON.stringify(event));
    }

    res.status(202).send(); // Accepted
});

app.get('/events', (req, res) => {
    const requested = Number(req.query.limit);
    const limit = Number.isFinite(requested) && requested > 0
        ? Math.min(Math.floor(requested), MAX_EVENTS)
        : 200;
    res.json(events.slice(-limit));
});

app.get('/stats', (_req, res) => {
    const counts: Record<string, number> = {};
    for (const e of events) {
        const key = e.type || 'unknown';
        counts[key] = (counts[key] || 0) + 1;
    }
    res.json({
        port,
        retained: events.length,
        maxEvents: MAX_EVENTS,
        counts
    });
});

app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ParkourBot Telemetry</title>
  <style>
    body { font-family: ui-monospace, Menlo, Consolas, monospace; margin: 0; padding: 16px; background: #0b1220; color: #dbeafe; }
    h1 { margin: 0 0 8px; font-size: 18px; }
    .muted { color: #93c5fd; font-size: 12px; margin-bottom: 12px; }
    #stats { margin-bottom: 12px; font-size: 12px; }
    #events { white-space: pre-wrap; font-size: 12px; line-height: 1.4; background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; max-height: 78vh; overflow: auto; }
  </style>
</head>
<body>
  <h1>ParkourBot Telemetry</h1>
  <div class="muted">Refreshing every 1s from <code>/events?limit=200</code></div>
  <div id="stats">Loading stats...</div>
  <div id="events">Loading events...</div>
  <script>
    async function refresh() {
      const [statsResp, eventsResp] = await Promise.all([
        fetch('/stats'),
        fetch('/events?limit=200')
      ]);
      const stats = await statsResp.json();
      const events = await eventsResp.json();
      document.getElementById('stats').textContent =
        'retained=' + stats.retained + ' max=' + stats.maxEvents + ' types=' + Object.keys(stats.counts || {}).length;
      document.getElementById('events').textContent =
        events.map((e) => JSON.stringify(e)).join('\\n');
    }
    refresh();
    setInterval(refresh, 1000);
  </script>
</body>
</html>`);
});

app.listen(port, () => {
    console.log(`Telemetry Service listening at http://localhost:${port}`);
});
