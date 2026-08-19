/**
 * Minimal browser Speech Recognition contract.
 *
 * The Web Speech API is not consistently declared across TypeScript DOM
 * versions, so keep its optional browser extension local instead of augmenting
 * the global Window interface in individual components.
 */
export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionResultEvent extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly [index: number]: SpeechRecognitionResult;
  };
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

export interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export function getSpeechRecognitionConstructor():
  | SpeechRecognitionConstructor
  | undefined {
  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return (
    browserWindow.SpeechRecognition ??
    browserWindow.webkitSpeechRecognition
  );
}