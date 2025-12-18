interface ImportMetaEnv {
  readonly VITE_ELEVENLABS_API_KEY: string;
  readonly VITE_REWARDFUL_PUBLIC_KEY?: string;
  readonly VITE_STRIPE_BETA_PRICE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}