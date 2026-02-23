
import { SHADOW_STYLES, IFRAME_STYLES } from './styles';
import { Config } from '@parkour-bot/shared';

// Host node logic
export class BotMount {
    hostNode: HTMLElement;
    shadowRoot: ShadowRoot | null = null;
    canvas: HTMLCanvasElement | null = null;
    iframeFallback: HTMLIFrameElement | null = null;
    config: Partial<Config>;
    pauseFab: HTMLButtonElement | null = null;
    private _onToggle: ((enabled: boolean) => void) | null = null;
    private _enabled: boolean = true;
    private readonly boundResize = this.resizeCanvas.bind(this);

    constructor(config: Partial<Config>) {
        this.config = config;
        this.hostNode = document.createElement('div');
        this.hostNode.id = 'pk-bot-host';
        this.hostNode.style.position = 'fixed';
        this.hostNode.style.top = '0';
        this.hostNode.style.left = '0';
        this.hostNode.style.width = '100vw';
        this.hostNode.style.height = '100vh';
        this.hostNode.style.pointerEvents = 'none';
        this.hostNode.style.zIndex = (this.config.z || 999999).toString();
    }

    mount() {
        // Try Shadow DOM first
        if (this.hostNode.attachShadow) {
            this.shadowRoot = this.hostNode.attachShadow({ mode: 'open' });
            this.initShadowDOM();
        } else {
            this.initIframeFallback();
        }

        document.body.appendChild(this.hostNode);
        this.createPauseFab();
    }

    /** Register a callback for when the user toggles pause/play */
    onToggle(cb: (enabled: boolean) => void) {
        this._onToggle = cb;
    }

    /** Update the FAB icon to reflect current state */
    setFabState(enabled: boolean) {
        this._enabled = enabled;
        if (this.pauseFab) {
            this.pauseFab.innerHTML = enabled ? this.pauseIcon() : this.playIcon();
            this.pauseFab.title = enabled ? 'Pause Bot' : 'Resume Bot';
            this.pauseFab.setAttribute('aria-label', enabled ? 'Pause Bot' : 'Resume Bot');
        }
    }

    private createPauseFab() {
        // Inject FAB styles into the document (outside shadow DOM for pointer events)
        if (!document.getElementById('pkb-fab-styles')) {
            const style = document.createElement('style');
            style.id = 'pkb-fab-styles';
            style.textContent = `
                #pkb-pause-fab {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: 1px solid rgba(56, 189, 248, 0.3);
                    background: rgba(15, 23, 42, 0.85);
                    backdrop-filter: blur(8px);
                    color: #38bdf8;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000000;
                    pointer-events: auto;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(56, 189, 248, 0.1);
                    padding: 0;
                    outline: none;
                }
                #pkb-pause-fab:hover {
                    transform: scale(1.12);
                    border-color: rgba(56, 189, 248, 0.6);
                    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.4), 0 0 25px rgba(56, 189, 248, 0.2);
                    background: rgba(30, 41, 59, 0.95);
                }
                #pkb-pause-fab:active {
                    transform: scale(0.95);
                }
                #pkb-pause-fab:focus-visible {
                    outline: 2px solid #38bdf8;
                    outline-offset: 3px;
                }
                #pkb-pause-fab svg {
                    width: 18px;
                    height: 18px;
                    fill: currentColor;
                }
                @media (prefers-reduced-motion: reduce) {
                    #pkb-pause-fab {
                        transition: none;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        const fab = document.createElement('button');
        fab.id = 'pkb-pause-fab';
        fab.title = 'Pause Bot';
        fab.setAttribute('aria-label', 'Pause Bot');
        fab.setAttribute('role', 'button');
        fab.setAttribute('data-bot-ignore', '');
        fab.innerHTML = this.pauseIcon();

        fab.addEventListener('click', () => {
            this._enabled = !this._enabled;
            this.setFabState(this._enabled);
            this._onToggle?.(this._enabled);
            console.log(`ParkourBot: ${this._enabled ? 'Resumed' : 'Paused'}`);
        });

        document.body.appendChild(fab);
        this.pauseFab = fab;
    }

    private pauseIcon(): string {
        return `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
    }

    private playIcon(): string {
        return `<svg viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20"/></svg>`;
    }

    private initShadowDOM() {
        if (!this.shadowRoot) return;

        const style = document.createElement('style');
        style.textContent = SHADOW_STYLES;
        this.shadowRoot.appendChild(style);

        this.canvas = document.createElement('canvas');
        this.canvas.width = window.innerWidth * window.devicePixelRatio;
        this.canvas.height = window.innerHeight * window.devicePixelRatio;
        this.shadowRoot.appendChild(this.canvas);

        window.addEventListener('resize', this.boundResize);
    }

    private initIframeFallback() {
        console.warn('ParkourBot: Using iframe fallback.');
        this.iframeFallback = document.createElement('iframe');
        this.iframeFallback.setAttribute('sandbox', 'allow-scripts allow-same-origin');

        Object.assign(this.iframeFallback.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            border: 'none',
            background: 'transparent'
        });

        this.iframeFallback.onload = () => {
            const doc = this.iframeFallback?.contentDocument;
            if (doc) {
                const style = doc.createElement('style');
                style.textContent = IFRAME_STYLES;
                if (doc.head) doc.head.appendChild(style);

                this.canvas = doc.createElement('canvas');
                this.canvas.width = window.innerWidth * window.devicePixelRatio;
                this.canvas.height = window.innerHeight * window.devicePixelRatio;
                if (doc.body) doc.body.appendChild(this.canvas);

                window.addEventListener('resize', this.boundResize);
            }
        };

        this.hostNode.appendChild(this.iframeFallback);
    }

    private resizeCanvas() {
        if (this.canvas) {
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
        }
    }

    getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    destroy() {
        if (this.hostNode.parentNode) {
            this.hostNode.parentNode.removeChild(this.hostNode);
        }
        if (this.pauseFab?.parentNode) {
            this.pauseFab.parentNode.removeChild(this.pauseFab);
        }
        const fabStyles = document.getElementById('pkb-fab-styles');
        if (fabStyles) fabStyles.remove();
        window.removeEventListener('resize', this.boundResize);
    }
}
