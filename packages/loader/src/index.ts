import { Config } from '@parkour-bot/shared';
import nacl from 'tweetnacl';
import { decodeUTF8, decodeBase64 } from 'tweetnacl-util';

// Loader constants
const CDN_BASE_URL = 'http://localhost:3000';
const API_BASE_URL = 'http://localhost:3001';

/**
 * Parses the current script tag to extract configuration.
 */
function parseScriptConfig(): Partial<Config> {
    // Find the script tag that loaded this script
    // Heuristic: look for the script with data-key attribute or specific src pattern
    const scripts = document.querySelectorAll('script');
    let currentScript: HTMLScriptElement | null = null;

    for (let i = 0; i < scripts.length; i++) {
        const s = scripts[i];
        if (s.hasAttribute('data-key') || (s.src && s.src.includes('loader.js'))) {
            currentScript = s;
            break;
        }
    }

    if (!currentScript) {
        console.warn('ParkourBot: Could not find loader script tag. Using defaults.');
        return {};
    }

    const config: Partial<Config> = {};

    // Extract attributes
    const key = currentScript.getAttribute('data-key');
    if (key) config.key = key;

    const bot = currentScript.getAttribute('data-bot');
    if (bot === 'on' || bot === 'off') config.bot = bot;

    const colliders = currentScript.getAttribute('data-colliders');
    if (colliders) config.colliders = colliders.split(',').map(s => s.trim());

    const deny = currentScript.getAttribute('data-deny');
    if (deny) config.deny = deny.split(',').map(s => s.trim());

    const theme = currentScript.getAttribute('data-theme');
    if (theme === 'neon' || theme === 'pixel' || theme === 'minimal') {
        config.theme = theme;
    }

    const z = currentScript.getAttribute('data-z');
    if (z) config.z = parseInt(z, 10);

    const region = currentScript.getAttribute('data-region');
    if (region === 'viewport' || region === 'hero' || region === 'full') {
        config.region = region;
    }

    return config;
}

/**
 * Detects runtime environment capabilities and preferences.
 */
function detectEnvironment() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersContrast = window.matchMedia('(prefers-contrast: more)').matches;

    return {
        isMobile,
        prefersReducedMotion,
        prefersContrast
    };
}

/**
 * Fetches configuration from the edge API.
 */
async function fetchConfig(key: string, host: string): Promise<any> {
    try {
        const response = await fetch(`${API_BASE_URL}/config?key=${encodeURIComponent(key)}&host=${encodeURIComponent(host)}`);
        if (!response.ok) {
            throw new Error(`Config fetch failed: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error('ParkourBot: Failed to fetch config', e);
        return null;
    }
}

/**
 * Loads the runtime bundle.
 */
function loadRuntime(version: string) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const fileName = version === 'local' ? 'runtime.js' : `runtime-${version}.js`;
        script.src = `${CDN_BASE_URL}/${fileName}`;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

const PUBLIC_KEY = 'AMdfi0CC7kEhl39PMxKG5XJgpn0xZq1tEUggRe3dzyY=';

// Config verification
function verifyConfigSignature(signedConfig: any): boolean {
    try {
        const { signature, ...payload } = signedConfig;
        if (!signature) return false;

        const message = JSON.stringify(payload);
        return nacl.sign.detached.verify(
            decodeUTF8(message),
            decodeBase64(signature),
            decodeBase64(PUBLIC_KEY)
        );
    } catch (e) {
        console.error('ParkourBot: Signature verification error', e);
        return false;
    }
}

// Main boot sequence
async function boot() {
    const localConfig = parseScriptConfig();
    const env = detectEnvironment();

    if (!localConfig.key) {
        console.error('ParkourBot: Missing data-key attribute. Aborting.');
        return;
    }

    // Determine host for allowlist check
    const host = window.location.hostname;

    console.log('ParkourBot: Booting...', { localConfig, env, host });

    // Fetch config from edge API
    let remoteConfig = await fetchConfig(localConfig.key, host);

    if (!remoteConfig) {
        console.warn('ParkourBot: Failed to retrieve remote configuration. Using local development fallback.');
        remoteConfig = {
            version: 'local',
            allowed: true,
            config: {
                theme: localConfig.theme || 'neon',
                colliders: localConfig.colliders || [],
                deny: localConfig.deny || []
            },
            features: {
                enableTelemetry: false,
                enableGraph: true
            },
            notBefore: 0,
            notAfter: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
            signature: 'dummy'
        };
    }

    // Verify signature (skip for local)
    if (remoteConfig.version !== 'local' && !verifyConfigSignature(remoteConfig)) {
        console.error('ParkourBot: Invalid config signature.');
        return;
    }

    // Verify validity window
    const now = Date.now();
    if (now < remoteConfig.notBefore || now > remoteConfig.notAfter) {
        console.error('ParkourBot: Config expired or not yet valid.');
        return;
    }

    // Enforce allowlist and kill switch
    if (!remoteConfig.allowed) {
        console.warn('ParkourBot: Domain not allowed.');
        return;
    }

    if (remoteConfig.killSwitch) {
        console.warn('ParkourBot: Kill switch verification active. Aborting.');
        return;
    }

    // Feature flags
    if (localConfig.bot === 'off') {
        console.log('ParkourBot: Disabled via data-bot="off".');
        return;
    }

    // Load runtime
    try {
        await loadRuntime(remoteConfig.version);
        console.log('ParkourBot: Runtime loaded.');

        // Initialize the runtime
        const combinedConfig = {
            ...remoteConfig.config,
            ...localConfig,
            features: remoteConfig.features
        };

        if ((window as any).ParkourBot) {
            (window as any).ParkourBot.init(combinedConfig);
        } else {
            // If runtime script hasn't registered yet, wait for it
            window.addEventListener('parkour-bot:ready', () => {
                // (Usually runtime script execution is synchronous after load)
            });
            // HACK: for our demo where names might conflict
            console.log('ParkourBot: Runtime loaded, initiating...');
            if ((window as any).ParkourBot) {
                (window as any).ParkourBot.init(combinedConfig);
            }
        }
    } catch (e) {
        console.error('ParkourBot: Failed to load runtime.', e);
    }
}

// Auto-boot if not disabled
// Use a small timeout to ensure DOM is partially ready or wait for DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
