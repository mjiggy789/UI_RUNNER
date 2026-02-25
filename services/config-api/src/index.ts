import express from 'express';
import nacl from 'tweetnacl';
import { decodeUTF8, encodeBase64 } from 'tweetnacl-util';
import fs from 'fs';
import path from 'path';

// Mock database
const KEYS: Record<string, { domains: string[], config: any, features: any }> = {
    'pk_test_123': {
        domains: ['localhost', '127.0.0.1', 'example.com'],
        config: {
            key: 'pk_test_123',
            bot: 'on',
            colliders: ['header', 'main', 'footer', '.card'],
            deny: ['button', 'a'],
            theme: 'neon',
            z: 999999,
            region: 'viewport'
        },
        features: {
            enableTelemetry: true,
            enablePremium: false
        }
    },
    'pk_local_test': {
        domains: ['localhost', '127.0.0.1'],
        config: {
            key: 'pk_local_test',
            bot: 'on',
            colliders: ['header', 'nav', 'footer', '.card'],
            deny: ['button', 'a'],
            theme: 'neon',
            z: 999999,
            region: 'viewport'
        },
        features: {
            enableTelemetry: true,
            enablePremium: true
        }
    },
    'pk_training_grounds': {
        domains: ['localhost', '127.0.0.1'],
        config: {
            key: 'pk_training_grounds',
            bot: 'on',
            colliders: ['.obstacle'], // Specialized for Training Grounds
            deny: [],
            theme: 'neon',
            z: 999999,
            region: 'viewport'
        },
        features: {
            enableTelemetry: true,
            enablePremium: true
        }
    }
};

// Signing keys (In production, load from environment/vault)
const SECRET_KEY_HEX = '597116b4c17a7449a3cf957eb7db3e9dd45ccb414b1e1fe49bc7001e89da73ee00c75f8b4082ee4121977f4f331286e57260a67d3166ad6d11482045edddcf26';
const SIGNING_KEY_PAIR = nacl.sign.keyPair.fromSecretKey(Buffer.from(SECRET_KEY_HEX, 'hex'));
console.log('Public Key for Verification (Base64):', encodeBase64(SIGNING_KEY_PAIR.publicKey));

import cors from 'cors';

const app = express();
const port = process.env.PORT || 4001;

app.use(cors());

app.get('/config', (req, res) => {
    const { key, host } = req.query;

    if (typeof key !== 'string' || typeof host !== 'string') {
        return res.status(400).json({ error: 'Missing key or host parameter' });
    }

    const clientData = KEYS[key];

    if (!clientData) {
        return res.json({
            allowed: false,
            killSwitch: false,
            error: 'Invalid key'
        });
    }

    const isAllowed = clientData.domains.includes(host) || clientData.domains.includes('*');

    // Read manifest for versioning
    let version = '1.0.0';
    try {
        const manifestPath = path.join(__dirname, '../../../release/manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        // e.g. "runtime": "runtime-3174d506.js"
        // we want the hash part: 3174d506
        const runtimeFile = manifest.runtime;
        if (runtimeFile) {
            const match = runtimeFile.match(/runtime-(.+)\.js/);
            if (match) version = match[1];
        }
    } catch (e) {
        console.error('Failed to read manifest', e);
    }

    const payload = {
        config: clientData.config,
        features: clientData.features,
        allowed: isAllowed,
        killSwitch: false,
        notBefore: Date.now() - 60000,
        notAfter: Date.now() + 3600000 * 24,
        version: version
    };

    // Sign the payload
    const message = JSON.stringify(payload);
    const signature = nacl.sign.detached(decodeUTF8(message), SIGNING_KEY_PAIR.secretKey);

    res.json({
        ...payload,
        signature: encodeBase64(signature)
    });
});

app.listen(port, () => {
    console.log(`Config API listening at http://localhost:${port}`);
});
