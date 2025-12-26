/**
 * Voice Manager using Web Speech API
 * Handles speech recognition (STT) and synthesis (TTS)
 */

export interface VoiceCallbacks {
  onListeningStart?: () => void;
  onListeningEnd?: () => void;
  onSpeechResult?: (text: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onError?: (error: string) => void;
}

export class VoiceManager {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private callbacks: VoiceCallbacks;
  private isListening = false;
  private isSpeaking = false;
  private continuousMode = false;

  constructor(callbacks: VoiceCallbacks = {}, continuous: boolean = false) {
    this.callbacks = callbacks;
    this.synthesis = window.speechSynthesis;
    this.continuousMode = continuous;
    this.initializeRecognition();
  }

  private initializeRecognition(): void {
    // Check for browser support
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.callbacks.onError?.('Speech recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.callbacks.onListeningStart?.();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.callbacks.onListeningEnd?.();

      // Auto-restart in continuous mode (unless speaking)
      if (this.continuousMode && !this.isSpeaking) {
        setTimeout(() => {
          if (!this.isSpeaking) {
            this.startListening();
          }
        }, 1000);
      }
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      this.callbacks.onSpeechResult?.(transcript);
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;

      const errorMessages: Record<string, string> = {
        'no-speech': 'No speech detected',
        'audio-capture': 'Microphone not available',
        'not-allowed': 'Microphone permission denied',
        'network': 'Connection error - check internet',
        'aborted': 'Speech recognition stopped',
        'service-not-allowed': 'Speech service blocked',
        'bad-grammar': 'Recognition error',
      };

      const message = errorMessages[event.error] || `Error: ${event.error}`;

      // Don't trigger error callback for "aborted" - it's usually intentional
      if (event.error === 'aborted') {
        this.callbacks.onListeningEnd?.();
        return;
      }

      this.callbacks.onError?.(message);
    };
  }

  /**
   * Start listening for speech input
   */
  startListening(): void {
    if (!this.recognition) {
      this.callbacks.onError?.('Speech recognition not available');
      return;
    }

    if (this.isListening) {
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      this.callbacks.onError?.(`Failed to start listening: ${error}`);
    }
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Speak text using TTS
   */
  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isSpeaking) {
        this.synthesis.cancel();
      }

      // Remove emojis and clean text for better speech
      const cleanText = this.cleanTextForSpeech(text);

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.95;  // Slightly slower for more natural sound
      utterance.pitch = 1.1;   // Slightly higher pitch for friendlier tone
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

      // Try to use a higher quality voice if available
      const voices = this.synthesis.getVoices();
      const preferredVoice = voices.find(voice =>
        voice.name.includes('Google') ||
        voice.name.includes('Natural') ||
        voice.name.includes('Enhanced') ||
        voice.name.includes('Premium')
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
        // Stop listening while speaking
        if (this.isListening) {
          this.stopListening();
        }
        this.callbacks.onSpeakingStart?.();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.callbacks.onSpeakingEnd?.();

        // Resume listening in continuous mode
        if (this.continuousMode) {
          setTimeout(() => {
            this.startListening();
          }, 500);
        }

        resolve();
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        this.callbacks.onError?.(`Speech synthesis error: ${event.error}`);
        reject(event.error);
      };

      this.synthesis.speak(utterance);
    });
  }

  /**
   * Clean text for speech by removing emojis and other non-speakable characters
   */
  private cleanTextForSpeech(text: string): string {
    // Remove emojis using regex
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu;
    let cleanText = text.replace(emojiRegex, '');

    // Remove multiple spaces
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return cleanText;
  }

  /**
   * Stop current speech
   */
  stopSpeaking(): void {
    if (this.isSpeaking) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  /**
   * Enable/disable continuous listening mode
   */
  setContinuousMode(enabled: boolean): void {
    this.continuousMode = enabled;
    if (enabled && !this.isListening && !this.isSpeaking) {
      this.startListening();
    } else if (!enabled && this.isListening) {
      this.stopListening();
    }
  }

  /**
   * Check if in continuous mode
   */
  isContinuous(): boolean {
    return this.continuousMode;
  }

  /**
   * Check if speech recognition is supported
   */
  static isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.continuousMode = false;
    this.stopListening();
    this.stopSpeaking();
  }
}

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  }

  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    readonly isFinal: boolean;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };
}
