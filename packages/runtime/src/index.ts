
import { BotMount } from './mount';
import { Config, FeatureFlags } from '@parkour-bot/shared';
import { World } from './world';
import { Controller } from './controller';
import { Renderer, DebugVisualizationSettings, DEFAULT_DEBUG_VISUALIZATION_SETTINGS } from './renderer';
import { Brain } from './brain';

export * from './mount';

export interface RuntimeOptions extends Partial<Config> {
    features?: FeatureFlags;
}

type VisualizationToggleDef = {
    id: string;
    key: keyof DebugVisualizationSettings;
    label: string;
    description: string;
};

const VISUALIZATION_TOGGLES: VisualizationToggleDef[] = [
    { id: 'pkb-debug-master-toggle', key: 'master', label: 'Debug Visualizations', description: 'Master switch for all debug overlays.' },
    { id: 'pkb-viz-colliders-toggle', key: 'colliders', label: 'Collider Bounds', description: 'Draw detected platform and obstacle rectangles.' },
    { id: 'pkb-viz-collider-ids-toggle', key: 'colliderIds', label: 'Collider IDs', description: 'Show numeric collider IDs next to bounds.' },
    { id: 'pkb-viz-state-label-toggle', key: 'stateLabel', label: 'State Label', description: 'Render active brain state above the bot.' },
    { id: 'pkb-viz-targeting-toggle', key: 'targeting', label: 'Target Intent', description: 'Show current target marker and intent line.' },
    { id: 'pkb-viz-trajectory-toggle', key: 'trajectory', label: 'Trajectory Preview', description: 'Simulate expected jump and air path curves.' },
    { id: 'pkb-viz-route-toggle', key: 'route', label: 'Route Links', description: 'Draw step-to-final subtarget routing links.' },
    { id: 'pkb-viz-steering-toggle', key: 'steering', label: 'Steering Math', description: 'Visualize deadzone, sticky band, and move direction.' },
    { id: 'pkb-viz-probes-toggle', key: 'probes', label: 'Collision Probes', description: 'Show wall, ceiling, gap, and drop planning probes.' },
    { id: 'pkb-viz-tictac-toggle', key: 'ticTac', label: 'Tic-Tac Logic', description: 'Show corridor width, eligibility, and kick direction.' },
    { id: 'pkb-viz-input-vector-toggle', key: 'inputVector', label: 'Input Vector', description: 'Draw facing/input bias vector from the bot.' },
    { id: 'pkb-viz-timers-toggle', key: 'timers', label: 'Timer Breakdown', description: 'Include cooldown and stagnation timers in HUD.' }
];

class Runtime {
    mount: BotMount;
    world: World;
    controller: Controller;
    renderer: Renderer;
    brain: Brain;
    config: RuntimeOptions;
    lastTime: number = 0;
    running: boolean = false;
    private _enabled: boolean = true;
    get enabled(): boolean { return this._enabled; }

    debugMode: boolean = false;
    visualizationSettings: DebugVisualizationSettings = {
        ...DEFAULT_DEBUG_VISUALIZATION_SETTINGS,
        master: false
    };
    settingsOpen: boolean = false;
    settingsEl: HTMLElement | null = null;
    manualAnchor: { x: number; y: number } | null = null;
    targetYAnchor: number | null = null;
    realWebsiteMode: boolean = false;
    realWebsiteEl: HTMLElement | null = null;
    logOpen: boolean = false;
    logEl: HTMLElement | null = null;
    logErrorsOnly: boolean = true;

    constructor(config: RuntimeOptions) {
        this.config = config;
        this.mount = new BotMount(config);
        this.world = new World(config);
        this.controller = new Controller(this.world, window.innerWidth / 4, window.innerHeight / 2);
        this.world.setPoseProvider(() => this.controller.pose);
        console.log('ParkourBot: Initialized at', window.innerWidth / 4, window.innerHeight / 2);
        this.renderer = new Renderer(document.createElement('canvas'), config.theme);
        this.brain = new Brain(this.world);

        // Listen for SPA navigation
        window.addEventListener('popstate', () => this.rescan());

        // Listen for diagnostics
        window.addEventListener('parkour-bot:diagnostic', (e: any) => {
            if (this.config.features?.enableTelemetry && e.detail) {
                this.sendTelemetry(e.detail.type, e.detail);
            }
        });

        // Keyboard handlers
        window.addEventListener('keydown', (e) => {
            // Don't trigger if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
                return;
            }

            const key = e.key.toLowerCase();
            if (key === 'd') {
                this.debugMode = !this.debugMode;
                this.visualizationSettings.master = this.debugMode;
                const debugToggle = document.getElementById('pkb-debug-master-toggle') as HTMLInputElement | null;
                if (debugToggle) debugToggle.checked = this.debugMode;
                console.log('ParkourBot: Debug Mode', this.debugMode ? 'ON' : 'OFF');
            }
            if (key === 's') {
                this.toggleSettings();
            }
            if (key === 'l') {
                this.toggleLogs();
            }
            if (key === 'r') {
                this.respawnBot();
            }
        });

        // Double Click for Manual Target
        window.addEventListener('dblclick', (e) => {
            if (this.brain.manualMode) {
                const viewportX = e.pageX - window.scrollX;
                const viewportY = e.pageY - window.scrollY;
                this.brain.setManualTarget(viewportX, viewportY);
                this.manualAnchor = { x: e.pageX, y: e.pageY };
                console.log(`ParkourBot: Manual Target at (${Math.round(viewportX)}, ${Math.round(viewportY)})`);
            }
        });
    }

    private renderToggleRow(id: string, label: string, description: string, checked: boolean): string {
        return `
            <div class="pkb-setting-row">
                <div>
                    <div class="pkb-setting-label">${label}</div>
                    <div class="pkb-setting-desc">${description}</div>
                </div>
                <label class="pkb-toggle">
                    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
                    <span class="pkb-toggle-track"></span>
                </label>
            </div>
        `;
    }

    private syncSettingsState() {
        const strict = document.getElementById('pkb-strict-toggle') as HTMLInputElement | null;
        if (strict) strict.checked = this.brain.strictMode;
        const manual = document.getElementById('pkb-manual-toggle') as HTMLInputElement | null;
        if (manual) manual.checked = this.brain.manualMode;
        const realSite = document.getElementById('pkb-realsite-toggle') as HTMLInputElement | null;
        if (realSite) realSite.checked = this.realWebsiteMode;

        for (const def of VISUALIZATION_TOGGLES) {
            const el = document.getElementById(def.id) as HTMLInputElement | null;
            if (el) el.checked = this.visualizationSettings[def.key];
        }
    }

    private wireVisualizationToggles() {
        for (const def of VISUALIZATION_TOGGLES) {
            const toggle = document.getElementById(def.id) as HTMLInputElement | null;
            if (!toggle) continue;
            toggle.addEventListener('change', () => {
                this.visualizationSettings[def.key] = toggle.checked;

                if (def.key === 'master') {
                    this.debugMode = toggle.checked;
                } else if (toggle.checked && !this.visualizationSettings.master) {
                    this.visualizationSettings.master = true;
                    this.debugMode = true;
                    const masterToggle = document.getElementById('pkb-debug-master-toggle') as HTMLInputElement | null;
                    if (masterToggle) masterToggle.checked = true;
                }

                console.log(`ParkourBot: ${def.label}`, this.visualizationSettings[def.key] ? 'ON' : 'OFF');
            });
        }
    }

    private toggleSettings() {
        this.settingsOpen = !this.settingsOpen;
        if (this.settingsOpen) {
            this.showSettings();
        } else {
            this.hideSettings();
        }
    }

    private showSettings() {
        if (this.settingsEl) {
            this.settingsEl.style.display = 'flex';
            this.syncSettingsState();
            return;
        }

        // Inject styles
        const style = document.createElement('style');
        style.id = 'pkb-settings-styles';
        style.textContent = `
            :root {
                --pkb-ui-bg: #1e293b;
                --pkb-ui-border: #334155;
                --pkb-ui-text: #f1f5f9;
                --pkb-ui-muted: #94a3b8;
                --pkb-ui-accent: #f59e0b;
                --pkb-ui-accent-soft: #fbbf24;
                --pkb-ui-button: #334155;
                --pkb-ui-button-hover: #475569;
            }
            #pkb-settings-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            #pkb-settings-panel {
                background: var(--pkb-ui-bg);
                border: 1px solid var(--pkb-ui-border);
                border-radius: 16px;
                padding: 32px;
                min-width: 340px;
                max-width: min(760px, 92vw);
                max-height: min(84vh, 820px);
                overflow-y: auto;
                color: var(--pkb-ui-text);
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            }
            #pkb-settings-panel h2 {
                margin: 0 0 8px 0;
                font-size: 20px;
                color: var(--pkb-ui-accent);
            }
            #pkb-settings-panel .pkb-subtitle {
                margin: 0 0 24px 0;
                font-size: 13px;
                color: var(--pkb-ui-muted);
            }
            .pkb-setting-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 0;
                border-top: 1px solid var(--pkb-ui-border);
            }
            .pkb-settings-group {
                margin-top: 18px;
                padding-top: 12px;
                border-top: 1px solid rgba(148, 163, 184, 0.25);
                font-size: 12px;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--pkb-ui-accent-soft);
            }
            .pkb-setting-label {
                font-size: 14px;
                font-weight: 500;
            }
            .pkb-setting-desc {
                font-size: 12px;
                color: var(--pkb-ui-muted);
                margin-top: 2px;
            }
            .pkb-toggle {
                position: relative;
                width: 44px;
                height: 24px;
                flex-shrink: 0;
                margin-left: 16px;
            }
            .pkb-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .pkb-toggle-track {
                position: absolute;
                inset: 0;
                background: #475569;
                border-radius: 12px;
                cursor: pointer;
                transition: background 0.2s;
            }
            .pkb-toggle-track::after {
                content: '';
                position: absolute;
                width: 18px;
                height: 18px;
                left: 3px;
                top: 3px;
                background: #f1f5f9;
                border-radius: 50%;
                transition: transform 0.2s;
            }
            .pkb-toggle input:checked + .pkb-toggle-track {
                background: var(--pkb-ui-accent);
            }
            .pkb-toggle input:checked + .pkb-toggle-track::after {
                transform: translateX(20px);
            }
            #pkb-settings-close {
                margin-top: 20px;
                width: 100%;
                padding: 10px;
                background: var(--pkb-ui-button);
                border: none;
                border-radius: 8px;
                color: var(--pkb-ui-text);
                font-size: 13px;
                cursor: pointer;
                transition: background 0.15s;
            }
            #pkb-settings-close:hover {
                background: var(--pkb-ui-button-hover);
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'pkb-settings-overlay';
        overlay.setAttribute('data-bot-ignore', '');
        const coreRows = [
            this.renderToggleRow(
                'pkb-strict-toggle',
                'Strict Mode',
                'Bot must reach each target before selecting a new one. Unlimited retries.',
                this.brain.strictMode
            ),
            this.renderToggleRow(
                'pkb-manual-toggle',
                'Manual Mode',
                'Double-click to set target. Auto-targeting paused.',
                this.brain.manualMode
            ),
            this.renderToggleRow(
                'pkb-realsite-toggle',
                'Real Website Mode',
                'Replace training grounds with a realistic landing page.',
                this.realWebsiteMode
            ),
            this.renderToggleRow(
                'pkb-telemetry-toggle',
                'Telemetry Display',
                'Show real-time internal state and decision metrics overlay.',
                this.visualizationSettings.hud
            )
        ].join('');
        const visualizationRows = VISUALIZATION_TOGGLES
            .map(def => this.renderToggleRow(def.id, def.label, def.description, this.visualizationSettings[def.key]))
            .join('');
        overlay.innerHTML = `
            <div id="pkb-settings-panel">
                <h2>⚙ Bot Settings</h2>
                <p class="pkb-subtitle">Press <kbd>S</kbd> to close</p>

                ${coreRows}
                <div class="pkb-settings-group">Debug Visualizations</div>
                ${visualizationRows}

                <button id="pkb-settings-close">Close</button>
            </div>
        `;

        document.body.appendChild(overlay);
        this.settingsEl = overlay;

        // Wire toggles
        const strictToggle = document.getElementById('pkb-strict-toggle') as HTMLInputElement;
        strictToggle?.addEventListener('change', () => {
            this.brain.strictMode = strictToggle.checked;
            console.log('ParkourBot: Strict Mode', this.brain.strictMode ? 'ON' : 'OFF');
        });

        const manualToggle = document.getElementById('pkb-manual-toggle') as HTMLInputElement;
        manualToggle?.addEventListener('change', () => {
            if (manualToggle.checked) {
                this.brain.manualMode = true;
            } else {
                this.brain.clearManualTarget();
            }
            console.log('ParkourBot: Manual Mode', this.brain.manualMode ? 'ON' : 'OFF');
        });

        const realSiteToggle = document.getElementById('pkb-realsite-toggle') as HTMLInputElement;
        realSiteToggle?.addEventListener('change', () => {
            this.realWebsiteMode = realSiteToggle.checked;
            this.toggleRealWebsite(this.realWebsiteMode);
            console.log('ParkourBot: Real Website Mode', this.realWebsiteMode ? 'ON' : 'OFF');
        });

        const telemetryToggle = document.getElementById('pkb-telemetry-toggle') as HTMLInputElement;
        telemetryToggle?.addEventListener('change', () => {
            this.visualizationSettings.hud = telemetryToggle.checked;
            console.log('ParkourBot: Telemetry Display', this.visualizationSettings.hud ? 'ON' : 'OFF');
        });

        this.wireVisualizationToggles();
        this.syncSettingsState();

        // Close button
        document.getElementById('pkb-settings-close')?.addEventListener('click', () => {
            this.toggleSettings();
        });

        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.toggleSettings();
            }
        });
    }

    private hideSettings() {
        if (this.settingsEl) {
            this.settingsEl.style.display = 'none';
        }
    }

    private toggleLogs() {
        this.logOpen = !this.logOpen;
        if (this.logOpen) {
            this.showLogs();
        } else {
            this.hideLogs();
        }
    }

    private showLogs() {
        if (this.logEl) {
            this.logEl.style.display = 'flex';
            this.updateLogs();
            return;
        }

        // Inject styles
        if (!document.getElementById('pkb-log-styles')) {
            const style = document.createElement('style');
            style.id = 'pkb-log-styles';
            style.textContent = `
                #pkb-log-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(2px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000000;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
                }
                #pkb-log-panel {
                    background: rgba(15, 23, 42, 0.95);
                    border: 1px solid rgba(56, 189, 248, 0.4);
                    border-radius: 12px;
                    padding: 24px;
                    width: 95vw;
                    height: 85vh;
                    max-width: 1400px;
                    display: flex;
                    flex-direction: column;
                    color: #cbd5e1;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                #pkb-log-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                #pkb-log-header h2 {
                    margin: 0;
                    font-size: 18px;
                    color: #38bdf8;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .pkb-log-controls {
                    display: flex;
                    gap: 12px;
                }
                #pkb-log-body {
                    flex: 1;
                    overflow: auto;
                    background: rgba(2, 6, 23, 0.5);
                    border: 1px solid rgba(30, 41, 59, 0.8);
                    border-radius: 6px;
                    padding: 12px;
                    margin: 0;
                    font-size: 12px;
                    line-height: 1.5;
                    white-space: pre;
                    color: #94a3b8;
                }
                .pkb-log-btn {
                    padding: 6px 12px;
                    background: #334155;
                    border: 1px solid #475569;
                    border-radius: 6px;
                    color: #f1f5f9;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .pkb-log-btn:hover {
                    background: #475569;
                    border-color: #38bdf8;
                }
                #pkb-log-close-btn {
                    background: #38bdf8;
                    color: #0f172a;
                    border-color: #0ea5e9;
                    font-weight: 600;
                }
                #pkb-log-close-btn:hover {
                    background: #7dd3fc;
                }
            `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement('div');
        overlay.id = 'pkb-log-overlay';
        overlay.setAttribute('data-bot-ignore', '');
        overlay.innerHTML = `
            <div id="pkb-log-panel">
                <div id="pkb-log-header">
                    <h2>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Brain Event Log
                    </h2>
                    <div class="pkb-log-controls">
                        <button class="pkb-log-btn" id="pkb-log-toggle-mode-btn">Show All Events</button>
                        <button class="pkb-log-btn" id="pkb-log-copy-btn">Copy to Clipboard</button>
                        <button class="pkb-log-btn" id="pkb-log-export-btn">Export JSON</button>
                        <button class="pkb-log-btn" id="pkb-log-clear-btn">Clear Log</button>
                        <button class="pkb-log-btn" id="pkb-log-close-btn">Close [L]</button>
                    </div>
                </div>
                <pre id="pkb-log-body"></pre>
            </div>
        `;

        document.body.appendChild(overlay);
        this.logEl = overlay;

        // Toggle mode button
        const toggleBtn = document.getElementById('pkb-log-toggle-mode-btn');
        toggleBtn?.addEventListener('click', () => {
            this.logErrorsOnly = !this.logErrorsOnly;
            if (toggleBtn) toggleBtn.textContent = this.logErrorsOnly ? 'Show All Events' : 'Show Errors Only';
            this.updateLogs();
        });

        // Copy button
        document.getElementById('pkb-log-copy-btn')?.addEventListener('click', () => {
            const text = this.brain.getLogText(this.logErrorsOnly);
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('pkb-log-copy-btn');
                if (btn) {
                    const oldText = btn.textContent;
                    btn.textContent = 'Copied!';
                    btn.style.borderColor = '#22c55e';
                    setTimeout(() => {
                        if (btn) {
                            btn.textContent = oldText;
                            btn.style.borderColor = '';
                        }
                    }, 2000);
                }
            });
        });

        // Export button
        document.getElementById('pkb-log-export-btn')?.addEventListener('click', () => {
            const data = this.brain.getRawLog(this.logErrorsOnly);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pkb-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        // Close button
        document.getElementById('pkb-log-close-btn')?.addEventListener('click', () => {
            this.toggleLogs();
        });

        // Clear button
        document.getElementById('pkb-log-clear-btn')?.addEventListener('click', () => {
            this.brain.log = [];
            this.updateLogs();
        });

        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.toggleLogs();
            }
        });

        this.updateLogs();
    }

    private hideLogs() {
        if (this.logEl) {
            this.logEl.style.display = 'none';
        }
    }

    private updateLogs() {
        if (!this.logOpen || !this.logEl) return;
        const body = document.getElementById('pkb-log-body');
        if (body) {
            body.textContent = this.brain.getLogText(this.logErrorsOnly);
            // Auto scroll to bottom
            body.scrollTop = body.scrollHeight;
        }
    }

    private toggleRealWebsite(enabled: boolean) {
        const gameStage = document.getElementById('game-stage');

        if (enabled) {
            // Hide training grounds
            if (gameStage) gameStage.style.display = 'none';

            // Inject fake landing page
            if (!this.realWebsiteEl) {
                const site = document.createElement('div');
                site.id = 'pkb-real-site';
                site.innerHTML = `
                    <style>
                        #pkb-real-site {
                            font-family: 'Comic Sans MS', 'Trebuchet MS', Verdana, sans-serif;
                            color: #111111;
                            min-height: 100vh;
                            padding: 18px 0 40px;
                            background-color: #080424;
                            background-image:
                                radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.2) 2px, transparent 0),
                                radial-gradient(circle at 75px 75px, rgba(122, 255, 255, 0.22) 2px, transparent 0),
                                repeating-linear-gradient(
                                    45deg,
                                    rgba(255, 0, 128, 0.14) 0 18px,
                                    rgba(0, 255, 255, 0.12) 18px 36px
                                );
                            background-size: 100px 100px, 100px 100px, 180px 180px;
                        }
                        #pkb-real-site * {
                            box-sizing: border-box;
                        }
                        #pkb-real-site a {
                            color: #0033cc;
                            text-decoration: underline;
                            font-weight: 700;
                        }
                        #pkb-real-site a:hover {
                            color: #ff0066;
                        }
                        #pkb-myspace-shell {
                            width: min(980px, 94vw);
                            margin: 0 auto;
                            border: 4px ridge #ff8dc2;
                            background: #fff8ff;
                            box-shadow: 0 10px 0 #2d1455, 0 0 0 6px #ffffff;
                        }
                        #pkb-top-banner {
                            border-bottom: 4px double #000;
                            background: linear-gradient(90deg, #4de2ff 0%, #fff799 45%, #ff8ee1 100%);
                            padding: 12px 14px 10px;
                        }
                        #pkb-top-banner h1 {
                            margin: 0;
                            font-size: clamp(25px, 4.8vw, 44px);
                            letter-spacing: 1px;
                            color: #112244;
                            text-shadow: 2px 2px 0 #fff;
                        }
                        #pkb-tagline {
                            margin-top: 8px;
                            padding: 6px 8px;
                            background: #fff;
                            border: 2px dashed #10243f;
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 13px;
                        }
                        #pkb-marquee-row {
                            margin-top: 8px;
                            background: #000;
                            color: #fff;
                            border: 2px solid #f9fbff;
                            padding: 3px 4px;
                            font-size: 13px;
                        }
                        .pkb-blink {
                            animation: pkbBlink 1s steps(2, start) infinite;
                            color: #ff005d;
                            font-weight: 700;
                        }
                        @keyframes pkbBlink {
                            50% { opacity: 0; }
                        }
                        #pkb-navstrip {
                            margin-top: 9px;
                            background: #081426;
                            color: #f3f8ff;
                            border: 2px solid #ffffff;
                            padding: 8px;
                            font-size: 13px;
                            display: flex;
                            flex-wrap: wrap;
                            gap: 8px;
                        }
                        .pkb-nav-pill {
                            padding: 2px 8px;
                            background: #1c2e49;
                            border: 1px solid #89b3ff;
                            color: #e9f4ff;
                            border-radius: 2px;
                        }
                        #pkb-layout {
                            display: grid;
                            grid-template-columns: 260px 1fr;
                            gap: 14px;
                            padding: 14px;
                        }
                        .pkb-panel {
                            border: 3px outset #ffffff;
                            background: #ebf5ff;
                        }
                        #pkb-profile {
                            padding: 10px;
                            display: flex;
                            flex-direction: column;
                            gap: 10px;
                        }
                        .pkb-titlebar {
                            margin: 0;
                            padding: 4px 8px;
                            font-size: 14px;
                            text-transform: uppercase;
                            letter-spacing: 0.7px;
                            color: #fff;
                            background: linear-gradient(90deg, #052b78, #0f6df3);
                            border-bottom: 2px solid #001435;
                        }
                        #pkb-profile-photo {
                            height: 210px;
                            border: 2px solid #00153d;
                            background:
                                radial-gradient(circle at 30% 30%, #fff 0 4px, transparent 5px),
                                radial-gradient(circle at 70% 70%, #fff 0 4px, transparent 5px),
                                linear-gradient(135deg, #ff9cd2, #ffe57f 55%, #79e6ff);
                        }
                        .pkb-stamp-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 6px;
                            font-size: 11px;
                        }
                        .pkb-stamp {
                            border: 1px solid #000;
                            background: #fff58e;
                            padding: 4px 5px;
                            text-align: center;
                            font-weight: 700;
                        }
                        .pkb-status {
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 12px;
                            border: 2px dotted #04153a;
                            background: #fff;
                            padding: 8px;
                            line-height: 1.35;
                        }
                        #pkb-main-column {
                            display: flex;
                            flex-direction: column;
                            gap: 12px;
                        }
                        .pkb-card {
                            padding: 0 0 10px;
                            background: #f9fcff;
                            border: 3px groove #f2f8ff;
                        }
                        .pkb-card .pkb-body {
                            padding: 9px 11px;
                            font-size: 14px;
                            line-height: 1.48;
                        }
                        #pkb-hero-copy {
                            font-size: 16px;
                            color: #081a3f;
                        }
                        #pkb-hero-copy strong {
                            color: #d10052;
                            background: #fff597;
                            padding: 1px 4px;
                            border: 1px dashed #510021;
                        }
                        #pkb-mini-links {
                            display: grid;
                            grid-template-columns: repeat(3, minmax(0, 1fr));
                            gap: 8px;
                        }
                        .pkb-link-tile {
                            border: 1px solid #001337;
                            background: #d8ebff;
                            padding: 7px;
                            text-align: center;
                            font-size: 12px;
                            font-weight: 700;
                        }
                        #pkb-music {
                            margin-top: 8px;
                            border: 2px inset #fff;
                            background: #061227;
                            color: #8dffcc;
                            padding: 7px 9px;
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 12px;
                        }
                        #pkb-blogroll ul {
                            margin: 6px 0 0 16px;
                            padding: 0;
                        }
                        #pkb-blogroll li {
                            margin: 5px 0;
                        }
                        #pkb-update-table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 13px;
                            margin-top: 4px;
                        }
                        #pkb-update-table th,
                        #pkb-update-table td {
                            border: 1px solid #001642;
                            padding: 6px;
                            text-align: left;
                        }
                        #pkb-update-table th {
                            background: #072d6f;
                            color: #fff;
                        }
                        #pkb-update-table tr:nth-child(odd) td {
                            background: #f4f9ff;
                        }
                        #pkb-guestbook .pkb-note {
                            border: 1px dashed #00153a;
                            background: #fff;
                            padding: 7px;
                            margin-top: 7px;
                            font-size: 13px;
                        }
                        #pkb-counter {
                            display: inline-block;
                            margin-top: 6px;
                            font-family: 'Courier New', Courier, monospace;
                            letter-spacing: 3px;
                            border: 2px inset #000;
                            color: #00f8ff;
                            background: #000;
                            padding: 4px 7px;
                        }
                        #pkb-site-footer {
                            margin: 0 14px 14px;
                            border: 2px solid #00143a;
                            background: #e0efff;
                            padding: 10px;
                            font-size: 12px;
                            display: flex;
                            flex-wrap: wrap;
                            justify-content: space-between;
                            gap: 8px;
                        }
                        #pkb-webring {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 6px;
                        }
                        .pkb-webring-btn {
                            border: 1px solid #000;
                            background: #fff08a;
                            padding: 2px 7px;
                            font-weight: 700;
                        }
                        @media (max-width: 900px) {
                            #pkb-layout {
                                grid-template-columns: 1fr;
                            }
                            #pkb-profile-photo {
                                height: 160px;
                            }
                            #pkb-mini-links {
                                grid-template-columns: repeat(2, minmax(0, 1fr));
                            }
                        }
                        @media (max-width: 540px) {
                            #pkb-top-banner h1 {
                                font-size: 28px;
                            }
                            #pkb-mini-links {
                                grid-template-columns: 1fr;
                            }
                        }
                    </style>

                    <div id="pkb-myspace-shell" data-bot-oneway>
                        <header id="pkb-top-banner" data-bot-oneway>
                            <h1>StarByte SpaceStation 2006</h1>
                            <div id="pkb-tagline">
                                Hand-coded with tables, gradients, and questionable taste.
                                <span class="pkb-blink">UNDER CONSTRUCTION</span>
                            </div>
                            <div id="pkb-marquee-row">
                                <marquee behavior="alternate" scrollamount="7">
                                    Welcome 2 my page * Sign my guestbook * Add me 2 your top 8 * Best viewed in 1024x768
                                </marquee>
                            </div>
                            <div id="pkb-navstrip" data-bot-oneway>
                                <span class="pkb-nav-pill">Home</span>
                                <span class="pkb-nav-pill">About Me</span>
                                <span class="pkb-nav-pill">Top Friends</span>
                                <span class="pkb-nav-pill">Blog</span>
                                <span class="pkb-nav-pill">Photos</span>
                                <span class="pkb-nav-pill">Guestbook</span>
                            </div>
                        </header>

                        <div id="pkb-layout" data-bot-oneway>
                            <aside id="pkb-profile" class="pkb-panel" data-bot-oneway>
                                <h2 class="pkb-titlebar">Profile Card</h2>
                                <div id="pkb-profile-photo" aria-label="Pixel portrait"></div>
                                <div class="pkb-status">
                                    mood: caffeinated<br>
                                    listening to: chiptune mixtape vol. 3<br>
                                    status: coding until 3am
                                </div>
                                <div class="pkb-stamp-grid" data-bot-oneway>
                                    <div class="pkb-stamp">HTML 4.01</div>
                                    <div class="pkb-stamp">CSS2 PRO</div>
                                    <div class="pkb-stamp">NO FLASH</div>
                                    <div class="pkb-stamp">BLOG CORE</div>
                                </div>
                                <div class="pkb-status">
                                    Visitor Counter:<br>
                                    <span id="pkb-counter">00133742</span>
                                </div>
                            </aside>

                            <main id="pkb-main-column" data-bot-oneway>
                                <section id="pkb-welcome" class="pkb-card pkb-panel" data-bot-oneway>
                                    <h2 class="pkb-titlebar">Bulletin Board</h2>
                                    <div class="pkb-body">
                                        <p id="pkb-hero-copy">
                                            <strong>Big update:</strong> rebuilt the entire site with hand-made gradients and weird png sparkle energy.
                                        </p>
                                        <div id="pkb-mini-links" data-bot-oneway>
                                            <a class="pkb-link-tile" href="#">Read zine issue #4</a>
                                            <a class="pkb-link-tile" href="#">Steal this layout</a>
                                            <a class="pkb-link-tile" href="#">Join the webring</a>
                                            <a class="pkb-link-tile" href="#">8-bit playlist</a>
                                            <a class="pkb-link-tile" href="#">Pixel avatar pack</a>
                                            <a class="pkb-link-tile" href="#">ASCII art vault</a>
                                        </div>
                                        <div id="pkb-music">now playing: "dial-up dreams (nightcore edit)" [||||||||--]</div>
                                    </div>
                                </section>

                                <section id="pkb-blogroll" class="pkb-card pkb-panel" data-bot-oneway>
                                    <h2 class="pkb-titlebar">Indie Web Blogroll</h2>
                                    <div class="pkb-body">
                                        <p>Shouting out cool pages from the neighborhood net:</p>
                                        <ul>
                                            <li><a href="#">Neon Neko Terminal</a> - vaporwave tutorials + midi packs</li>
                                            <li><a href="#">GeoPunk Journal</a> - css experiments and webring drama</li>
                                            <li><a href="#">CRT Garden</a> - pixel comics, tiny games, open guestbook</li>
                                            <li><a href="#">Webmaster Graveyard</a> - dead links memorial + shrine builder</li>
                                        </ul>
                                    </div>
                                </section>

                                <section id="pkb-updates" class="pkb-card pkb-panel" data-bot-oneway>
                                    <h2 class="pkb-titlebar">Patch Notes</h2>
                                    <div class="pkb-body">
                                        <table id="pkb-update-table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Update</th>
                                                    <th>Mood</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>02.21.2006</td>
                                                    <td>Added starfield background and rainbow nav tabs.</td>
                                                    <td>hyped</td>
                                                </tr>
                                                <tr>
                                                    <td>02.17.2006</td>
                                                    <td>Moved links into a table so they feel official.</td>
                                                    <td>focused</td>
                                                </tr>
                                                <tr>
                                                    <td>02.08.2006</td>
                                                    <td>Finally fixed broken guestbook captcha font.</td>
                                                    <td>relieved</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section id="pkb-guestbook" class="pkb-card pkb-panel" data-bot-oneway>
                                    <h2 class="pkb-titlebar">Guestbook</h2>
                                    <div class="pkb-body">
                                        <div class="pkb-note"><b>pixelpirate88:</b> this layout absolutely slaps, add me to top friends!</div>
                                        <div class="pkb-note"><b>synth_kitten:</b> your glitter divider is elite. stealing respectfully.</div>
                                        <div class="pkb-note"><b>cmdr_dialup:</b> page loaded in 46 seconds, worth every second.</div>
                                    </div>
                                </section>
                            </main>
                        </div>

                        <footer id="pkb-site-footer" data-bot-oneway>
                            <div>Copyright 2006 StarByte. No AI generated sparkle GIFs were harmed.</div>
                            <div id="pkb-webring" data-bot-oneway>
                                <span class="pkb-webring-btn">[prev]</span>
                                <span class="pkb-webring-btn">[random]</span>
                                <span class="pkb-webring-btn">[next]</span>
                            </div>
                        </footer>
                    </div>
                `;
                document.body.insertBefore(site, document.body.firstChild);
                this.realWebsiteEl = site;
            } else {
                this.realWebsiteEl.style.display = 'block';
            }

            // Allow scrolling for the fake site
            document.body.style.overflow = 'auto';
        } else {
            // Show training grounds
            if (gameStage) gameStage.style.display = '';
            if (this.realWebsiteEl) this.realWebsiteEl.style.display = 'none';
            document.body.style.overflow = 'hidden';
        }

        // Rescan the world with the new DOM and respawn the bot
        setTimeout(() => {
            this.rescan();
            this.respawnBot();
        }, 100);
    }

    private respawnBot() {
        this.controller.respawn();
        this.brain.resetForRespawn();
        this.manualAnchor = null;

        console.log('ParkourBot: Respawned!');
    }


    start() {
        const existingInstance = (window as any).ParkourBotInstance;
        if (existingInstance instanceof Runtime) {
            console.warn('ParkourBot: Runtime already running.');
            return;
        }
        if (existingInstance) {
            console.warn('ParkourBot: Replacing invalid ParkourBotInstance value.');
        }

        this.mount.mount();

        // Wire the FAB toggle to Runtime.setEnabled
        this.mount.onToggle((enabled) => {
            this.setEnabled(enabled);
        });

        const canvas = this.mount.getCanvas();
        if (canvas) {
            this.renderer = new Renderer(canvas, this.config.theme);
        }

        this.world.init();
        this.running = true;
        (window as any).ParkourBotInstance = this;

        if (this.config.features?.enableTelemetry) {
            this.sendTelemetry('boot', {
                href: window.location.href,
                theme: this.config.theme
            });
        }

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.tick(t));
        window.dispatchEvent(new CustomEvent('parkour-bot:ready'));
    }

    rescan() {
        console.log('ParkourBot: Rescanning world...');
        if (this.config.features?.enableTelemetry) {
            this.sendTelemetry('rescan', {
                url: window.location.href,
                timestamp: Date.now()
            });
        }
        this.world.fullRescan();
    }

    setEnabled(enabled: boolean) {
        if (this._enabled === enabled) return;
        this._enabled = enabled;

        // Sync FAB visual state (in case called from API, not FAB click)
        this.mount.setFabState(enabled);

        if (!enabled) {
            this.mount.getCanvas()?.style.setProperty('display', 'none');
        } else {
            this.mount.getCanvas()?.style.setProperty('display', 'block');
        }

        if (this.config.features?.enableTelemetry) {
            this.sendTelemetry('pause_state', { enabled });
        }

        // Emit state event for external consumers
        window.dispatchEvent(new CustomEvent('parkour-bot:state', {
            detail: { enabled }
        }));
    }

    private async sendTelemetry(type: string, payload: any) {
        try {
            await fetch('http://localhost:4002/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    payload,
                    timestamp: Date.now()
                })
            });
        } catch (e) {
            // Silently fail
        }
    }

    stop() {
        this.running = false;
        this.mount.destroy();
        delete (window as any).ParkourBotInstance;
    }

    tick(now: number) {
        if (!this.running) return;

        try {
            const dt = Math.min((now - this.lastTime) / 1000, 0.1);
            this.lastTime = now;

            // Update Manual Target if anchored (Scroll Correction)
            if (this.brain.manualMode && this.manualAnchor) {
                const viewportX = this.manualAnchor.x - window.scrollX;
                const viewportY = this.manualAnchor.y - window.scrollY;
                const snapped = this.brain.updateManualTarget(viewportX, viewportY);
                if (snapped) {
                    this.manualAnchor = {
                        x: snapped.x + window.scrollX,
                        y: snapped.y + window.scrollY
                    };
                }
            } else {
                this.manualAnchor = null;
            }

            if (this.enabled) {
                const input = this.brain.think(this.controller.pose, dt);
                const lockedTarget = this.brain.lockedTargetId !== null
                    ? this.world.colliders.get(this.brain.lockedTargetId) ?? null
                    : null;
                const resolvedTargetY = this.brain.manualMode
                    ? (this.brain.manualTargetY ?? null)
                    : (this.brain.targetPlatform?.aabb.y1 ?? this.brain.autoTargetY ?? null);
                this.controller.brainTargetX = this.brain.targetX;
                if (this.brain.targetX === null) {
                    this.targetYAnchor = null;
                    this.controller.brainTargetY = null;
                } else if (resolvedTargetY !== null) {
                    this.targetYAnchor = resolvedTargetY;
                    this.controller.brainTargetY = resolvedTargetY;
                } else {
                    if (this.targetYAnchor === null) {
                        this.targetYAnchor = this.controller.pose.y + this.controller.pose.height / 2;
                    }
                    this.controller.brainTargetY = this.targetYAnchor;
                }
                this.controller.brainState = this.brain.currentState;
                this.controller.brainHitConfirmed = this.brain.hitConfirmedTimer > 0;
                this.controller.brainLastHitId = this.brain.lastHitId;
                this.controller.brainStrictMode = this.brain.strictMode;
                this.controller.brainRetryCount = this.brain.retryCount;
                this.controller.brainManualMode = this.brain.manualMode;
                this.controller.brainCurrentTargetId = this.brain.targetPlatform?.id ?? null;
                this.controller.brainLockedTargetId = this.brain.lockedTargetId;
                this.controller.brainLockedTargetX = lockedTarget ? (lockedTarget.aabb.x1 + lockedTarget.aabb.x2) / 2 : null;
                this.controller.brainLockedTargetY = lockedTarget ? lockedTarget.aabb.y1 : null;
                this.controller.brainDebugData = this.brain.debugSnapshot;
                this.controller.update(dt, input);

                const colliders = Array.from(this.world.colliders.values());
                if (!this.renderer.ctx) {
                    const canvas = this.mount.getCanvas();
                    if (canvas) this.renderer = new Renderer(canvas, this.config.theme);
                }
                this.renderer.draw(this.controller, colliders, this.debugMode, this.visualizationSettings);

                if (this.logOpen) {
                    this.updateLogs();
                }
            } else {
                // If disabled, just clear canvas or don't draw
                this.renderer.ctx?.clearRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
            }
        } catch (e) {
            console.error('ParkourBot: Tick Loop Error', e);
        }

        requestAnimationFrame((t) => this.tick(t));
    }
}

export function init(config: RuntimeOptions) {
    const runtime = new Runtime(config);
    runtime.start();
    return runtime;
}

// Global API surface
(window as any).ParkourBot = {
    init,
    rescan: () => (window as any).ParkourBotInstance?.rescan(),
    setEnabled: (e: boolean) => (window as any).ParkourBotInstance?.setEnabled(e),
    destroy: () => (window as any).ParkourBotInstance?.stop()
};
