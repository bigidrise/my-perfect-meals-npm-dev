/// <reference types="vite/client" />

declare module "qrcode" {
  interface QRCodeOptions {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
  }
  function toCanvas(canvas: HTMLCanvasElement, text: string, options?: QRCodeOptions): Promise<void>;
  function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  export = { toCanvas, toDataURL };
}

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLIC_KEY: string;
  readonly VITE_REWARDFUL_PUBLIC_KEY: string;
  readonly VITE_ELEVENLABS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
