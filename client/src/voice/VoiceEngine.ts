import { createSpeechRecognition, requestSpeechPermissions } from "@/lib/speechRecognition";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export interface VoiceEngineConfig {
  silenceBeforeGuideMs: number;
  allowBargeIn: boolean;
  neverFailOnSilence: boolean;
  resumeAfterInterrupt: boolean;
  promptStyle: "guided_conversation";
}

export const VOICE_CONFIG: VoiceEngineConfig = {
  silenceBeforeGuideMs: 5000,
  allowBargeIn: true,
  neverFailOnSilence: true,
  resumeAfterInterrupt: true,
  promptStyle: "guided_conversation",
};

export interface VoiceEngineCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onChefSpeak: (text: string) => Promise<void>;
  onChefStop: () => void;
  onReadyToGenerate: (collectedData: CollectedData) => void;
  onError: (error: string) => void;
  onPermissionDenied: () => void;
}

export interface CollectedData {
  ingredients: string[];
  preferences: string[];
  dietaryRules: string[];
  rawTranscripts: string[];
}

export interface StudioScript {
  studioType: string;
  openingPrompt: string;
  guidePrompts: string[];
  readyPrompt: string;
}

export class VoiceEngine {
  private state: VoiceState = "idle";
  private recognition: any = null;
  private callbacks: VoiceEngineCallbacks;
  private script: StudioScript;
  private config: VoiceEngineConfig;
  
  private collectedData: CollectedData = {
    ingredients: [],
    preferences: [],
    dietaryRules: [],
    rawTranscripts: [],
  };
  
  private currentGuideIndex = 0;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private hasResumedThisSilence = false;
  private hasOfferedToGenerate = false;
  private isBargedIn = false;
  private accumulatedTranscript = "";

  constructor(
    script: StudioScript,
    callbacks: VoiceEngineCallbacks,
    config: VoiceEngineConfig = VOICE_CONFIG
  ) {
    this.script = script;
    this.callbacks = callbacks;
    this.config = config;
  }

  async start(): Promise<boolean> {
    const hasPermission = await requestSpeechPermissions();
    if (!hasPermission) {
      this.callbacks.onPermissionDenied();
      return false;
    }

    this.setState("speaking");
    
    try {
      await this.callbacks.onChefSpeak(this.script.openingPrompt);
      this.startListening();
      return true;
    } catch (error) {
      console.error("VoiceEngine: Failed to speak opening prompt", error);
      this.startListening();
      return true;
    }
  }

  stop(): void {
    this.clearSilenceTimeout();
    this.stopListening();
    this.callbacks.onChefStop();
    this.setState("idle");
    this.reset();
  }

  bargeIn(): void {
    if (this.state === "speaking" && this.config.allowBargeIn) {
      console.log("VoiceEngine: Barge-in detected, stopping Chef");
      this.isBargedIn = true;
      this.callbacks.onChefStop();
      this.startListening();
    }
  }

  addIngredients(items: string[]): void {
    this.collectedData.ingredients.push(...items);
  }

  addPreferences(items: string[]): void {
    this.collectedData.preferences.push(...items);
  }

  addDietaryRules(items: string[]): void {
    this.collectedData.dietaryRules.push(...items);
  }

  getCollectedData(): CollectedData {
    return { ...this.collectedData };
  }

  getState(): VoiceState {
    return this.state;
  }

  private setState(newState: VoiceState): void {
    if (this.state !== newState) {
      console.log(`VoiceEngine: State ${this.state} -> ${newState}`);
      this.state = newState;
      this.callbacks.onStateChange(newState);
    }
  }

  private reset(): void {
    this.currentGuideIndex = 0;
    this.hasResumedThisSilence = false;
    this.hasOfferedToGenerate = false;
    this.isBargedIn = false;
    this.accumulatedTranscript = "";
    this.collectedData = {
      ingredients: [],
      preferences: [],
      dietaryRules: [],
      rawTranscripts: [],
    };
  }

  private startListening(resetSilenceFlag: boolean = true): void {
    this.setState("listening");
    if (resetSilenceFlag) {
      this.hasResumedThisSilence = false;
    }
    this.accumulatedTranscript = "";
    this.startSilenceTimer();

    this.recognition = createSpeechRecognition(
      (transcript: string, isFinal: boolean) => {
        this.handleTranscript(transcript, isFinal);
      },
      (error: string) => {
        this.handleError(error);
      },
      () => {
        this.handleRecognitionEnd();
      }
    );

    this.recognition.start();
  }

  private stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }

  private handleTranscript(transcript: string, isFinal: boolean): void {
    this.clearSilenceTimeout();
    this.hasResumedThisSilence = false;
    
    if (this.state === "speaking") {
      this.bargeIn();
    }

    this.accumulatedTranscript = transcript;
    this.callbacks.onTranscript(transcript, isFinal);

    if (isFinal && transcript.trim()) {
      this.processUserInput(transcript.trim());
    } else {
      this.startSilenceTimer();
    }
  }

  private handleError(error: string): void {
    console.error("VoiceEngine: Recognition error:", error);
    
    if (error === "not-allowed" || error === "permission-denied") {
      this.callbacks.onPermissionDenied();
      this.stop();
      return;
    }

    if (this.config.neverFailOnSilence && (error === "no-speech" || error === "aborted")) {
      this.startSilenceTimer();
      return;
    }

    this.callbacks.onError(error);
  }

  private handleRecognitionEnd(): void {
    if (this.state === "listening") {
      this.startSilenceTimer();
    }
  }

  private startSilenceTimer(): void {
    this.clearSilenceTimeout();
    
    this.silenceTimeout = setTimeout(() => {
      this.handleSilence();
    }, this.config.silenceBeforeGuideMs);
  }

  private clearSilenceTimeout(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  private async handleSilence(): Promise<void> {
    if (this.state !== "listening") return;
    
    if (this.hasResumedThisSilence) {
      await this.offerToGenerate();
      return;
    }

    this.hasResumedThisSilence = true;

    if (this.currentGuideIndex < this.script.guidePrompts.length) {
      const guidePrompt = this.script.guidePrompts[this.currentGuideIndex];
      this.currentGuideIndex++;
      
      this.setState("speaking");
      this.stopListening();
      
      try {
        await this.callbacks.onChefSpeak(guidePrompt);
        if (this.config.resumeAfterInterrupt || !this.isBargedIn) {
          this.isBargedIn = false;
          this.startListening(false);
        }
      } catch {
        this.startListening(false);
      }
    } else {
      await this.offerToGenerate();
    }
  }

  private async offerToGenerate(): Promise<void> {
    if (this.hasOfferedToGenerate) {
      this.startListening(false);
      return;
    }
    
    this.hasOfferedToGenerate = true;
    this.setState("speaking");
    this.stopListening();
    
    try {
      await this.callbacks.onChefSpeak(this.script.readyPrompt);
      this.startListening(false);
    } catch {
      this.startListening(false);
    }
  }

  private processUserInput(transcript: string): void {
    const lowerTranscript = transcript.toLowerCase();
    
    this.collectedData.rawTranscripts.push(transcript);

    if (this.isReadyCommand(lowerTranscript)) {
      this.finishConversation();
      return;
    }

    if (this.isCancelCommand(lowerTranscript)) {
      this.stop();
      return;
    }

    this.extractDataFromTranscript(transcript);
    this.startSilenceTimer();
    
    if (this.recognition) {
      this.recognition.start();
    }
  }

  private isReadyCommand(text: string): boolean {
    const readyPhrases = [
      "cook now", "let's cook", "make it", "generate", "create it",
      "build it", "i'm ready", "ready to cook", "that's it", "that's all",
      "go ahead", "start cooking", "done", "let's go"
    ];
    return readyPhrases.some(phrase => text.includes(phrase));
  }

  private isCancelCommand(text: string): boolean {
    const cancelPhrases = ["cancel", "stop", "never mind", "exit", "quit"];
    return cancelPhrases.some(phrase => text.includes(phrase));
  }

  private extractDataFromTranscript(transcript: string): void {
    const lower = transcript.toLowerCase();
    
    const dietaryKeywords = [
      "gluten-free", "gluten free", "dairy-free", "dairy free", "vegan", 
      "vegetarian", "keto", "low carb", "low-carb", "paleo", "diabetic",
      "no sugar", "sugar-free", "nut-free", "nut free", "allergy", "allergic",
      "lactose", "celiac", "halal", "kosher"
    ];
    
    const hasDietaryRule = dietaryKeywords.some(keyword => lower.includes(keyword));
    
    if (hasDietaryRule) {
      this.collectedData.dietaryRules.push(transcript);
    }
    
    const ingredientPatterns = [
      /i have (.+)/i,
      /got (.+)/i,
      /there's (.+)/i,
      /there is (.+)/i,
      /some (.+)/i,
      /leftover (.+)/i
    ];
    
    let foundIngredients = false;
    for (const pattern of ingredientPatterns) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const items = match[1].split(/,|and/).map(s => s.trim()).filter(Boolean);
        this.collectedData.ingredients.push(...items);
        foundIngredients = true;
        break;
      }
    }
    
    const foodWords = transcript.split(/[\s,]+/).filter(word => {
      const lower = word.toLowerCase();
      return lower.length > 2 && 
             !["the", "and", "some", "have", "got", "with", "also", "too", "like", "want"].includes(lower);
    });
    
    if (!foundIngredients && foodWords.length > 0) {
      this.collectedData.ingredients.push(...foodWords);
    }
    
    if (!hasDietaryRule && !foundIngredients) {
      this.collectedData.preferences.push(transcript);
    }
  }

  private finishConversation(): void {
    this.clearSilenceTimeout();
    this.stopListening();
    this.setState("thinking");
    this.callbacks.onReadyToGenerate(this.getCollectedData());
  }
}
