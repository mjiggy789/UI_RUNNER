
export const SHADOW_STYLES = `
  :host {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 999999;
    contain: layout style paint;
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

export const IFRAME_STYLES = `
  body {
    margin: 0;
    overflow: hidden;
    background: transparent;
    width: 100vw;
    height: 100vh;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
`;
