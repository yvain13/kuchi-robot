/**
 * Voice Manager using Web Speech API
 * Handles speech recognition (STT) and synthesis (TTS)
 * Fixed for iOS Safari compatibility
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
  private isIOS: boolean;
  private voicesLoaded = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor(callbacks: VoiceCallbacks = {}, continuous: boolean = false) {
    this.callbacks = callbacks;
    this.synthesis = window.speechSynthesis;
    this.continuousMode = continuous;
    
    // Detect iOS
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    this.initializeRecognition();
    this.preloadVoices();
    
    // iOS: Keep synthesis alive by pinging it periodically
    if (this.isIOS) {
      this.keepSynthesisAlive();
    }
  }

  /**
   * Preload voices - required for iOS
   */
  private preloadVoices(): void {
    const loadVoices = () => {
      this.cachedVoices = this.synthesis.getVoices();
      if (this.cachedVoices.length > 0) {
        this.voicesLoaded = true;
        console.log(`🔊 Loaded ${this.cachedVoices.length} voices`);
      }
    };

    // Try to load immediately
    loadVoices();

    // Also listen for voiceschanged event (required for some browsers)
    this.synthesis.onvoiceschanged = loadVoices;

    // iOS fallback: Try loading after a delay
    if (!this.voicesLoaded) {
      setTimeout(loadVoices, 100);
      setTimeout(loadVoices, 500);
      setTimeout(loadVoices, 1000);
    }
  }

  /**
   * iOS fix: Keep speech synthesis "warm" by periodically using it
   * This prevents iOS from putting the speech engine to sleep
   */
  private keepSynthesisAlive(): void {
    setInterval(() => {
      if (!this.isSpeaking) {
        // Speak empty/silent utterance to keep engine alive
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        this.synthesis.speak(utterance);
      }
    }, 10000); // Every 10 seconds
  }

  private initializeRecognition(): void {
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
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
        'network': 'Connection error',
        'aborted': 'Speech recognition stopped',
        'service-not-allowed': 'Speech service blocked',
      };

      const message = errorMessages[event.error] || `Error: ${event.error}`;

      if (event.error === 'aborted') {
        this.callbacks.onListeningEnd?.();
        return;
      }

      this.callbacks.onError?.(message);
    };
  }

  startListening(): void {
    if (!this.recognition) {
      this.callbacks.onError?.('Speech recognition not available');
      return;
    }

    if (this.isListening) return;

    try {
      this.recognition.start();
    } catch (error) {
      this.callbacks.onError?.(`Failed to start listening: ${error}`);
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Speak text using TTS - iOS optimized
   */
  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean text
      const cleanText = this.cleanTextForSpeech(text);
      
      if (!cleanText) {
        resolve();
        return;
      }

      // iOS FIX: Cancel any existing speech first
      this.synthesis.cancel();

      // iOS FIX: Small delay after cancel
      const startSpeech = () => {
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = this.isIOS ? 0.9 : 0.95;  // Slightly slower on iOS
        utterance.pitch = 1.05;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        // Select voice
        const voice = this.selectVoice();
        if (voice) {
          utterance.voice = voice;
        }

        // Event handlers
        utterance.onstart = () => {
          console.log('🔊 Speaking started');
          this.isSpeaking = true;
          if (this.isListening) {
            this.stopListening();
          }
          this.callbacks.onSpeakingStart?.();
        };

        utterance.onend = () => {
          console.log('🔊 Speaking ended');
          this.isSpeaking = false;
          this.callbacks.onSpeakingEnd?.();

          if (this.continuousMode) {
            setTimeout(() => this.startListening(), 500);
          }

          resolve();
        };

        utterance.onerror = (event) => {
          console.error('🔊 Speech error:', event.error);
          this.isSpeaking = false;

          // iOS often fires 'interrupted' - treat as success
          if (event.error === 'interrupted' || event.error === 'canceled') {
            this.callbacks.onSpeakingEnd?.();
            resolve();
            return;
          }

          this.callbacks.onError?.(`Speech error: ${event.error}`);
          reject(event.error);
        };

        // iOS FIX: Resume synthesis if paused
        if (this.synthesis.paused) {
          this.synthesis.resume();
        }

        // Speak
        this.synthesis.speak(utterance);

        // iOS FIX: Workaround for iOS 15+ bug where speech stops after ~15 seconds
        // Periodically check and resume if paused
        if (this.isIOS) {
          const checkInterval = setInterval(() => {
            if (!this.isSpeaking) {
              clearInterval(checkInterval);
              return;
            }
            
            if (this.synthesis.paused) {
              console.log('🔊 Resuming paused speech (iOS fix)');
              this.synthesis.resume();
            }
          }, 250);

          // Also set a timeout to resume
          const resumeTimeout = setTimeout(() => {
            if (this.synthesis.paused) {
              this.synthesis.resume();
            }
          }, 14000); // Before iOS 15 second timeout

          utterance.onend = () => {
            clearInterval(checkInterval);
            clearTimeout(resumeTimeout);
            this.isSpeaking = false;
            this.callbacks.onSpeakingEnd?.();
            resolve();
          };
        }
      };

      // iOS requires user gesture to initiate speech
      // Give a small delay after cancel to ensure clean state
      setTimeout(startSpeech, this.isIOS ? 100 : 50);
    });
  }

  /**
   * Select the best available voice
   */
  private selectVoice(): SpeechSynthesisVoice | null {
    // Refresh voices
    const voices = this.synthesis.getVoices();
    if (voices.length > 0) {
      this.cachedVoices = voices;
    }

    const availableVoices = this.cachedVoices;
    
    if (availableVoices.length === 0) {
      console.warn('No voices available');
      return null;
    }

    // iOS preferred voices
    if (this.isIOS) {
      const iosPreferred = availableVoices.find(v => 
        v.name.includes('Samantha') || // High quality iOS voice
        v.name.includes('Karen') ||
        v.name.includes('Daniel') ||
        (v.lang.startsWith('en') && v.localService)
      );
      if (iosPreferred) return iosPreferred;
    }

    // Desktop preferred voices
    const preferred = availableVoices.find(v =>
      v.name.includes('Google') ||
      v.name.includes('Natural') ||
      v.name.includes('Enhanced') ||
      v.name.includes('Premium') ||
      v.name.includes('Microsoft Zira') ||
      v.name.includes('Microsoft David')
    );
    if (preferred) return preferred;

    // Fallback to any English voice
    const englishVoice = availableVoices.find(v => v.lang.startsWith('en'));
    if (englishVoice) return englishVoice;

    // Last resort: first available voice
    return availableVoices[0];
  }

  /**
   * Clean text for speech
   */
  private cleanTextForSpeech(text: string): string {
    // Remove emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu;
    let cleanText = text.replace(emojiRegex, '');

    // Remove URLs
    cleanText = cleanText.replace(/https?:\/\/\S+/g, '');

    // Remove special characters that might cause issues
    cleanText = cleanText.replace(/[*#_~`]/g, '');

    // Remove multiple spaces and trim
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return cleanText;
  }

  stopSpeaking(): void {
    if (this.isSpeaking) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  setContinuousMode(enabled: boolean): void {
    this.continuousMode = enabled;
    if (enabled && !this.isListening && !this.isSpeaking) {
      this.startListening();
    } else if (!enabled && this.isListening) {
      this.stopListening();
    }
  }

  isContinuous(): boolean {
    return this.continuousMode;
  }

  static isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  /**
   * iOS: Unlock audio by playing a silent sound
   * MUST be called from a user gesture (like button click)
   */
  unlockAudio(): void {
    if (!this.isIOS) return;

    console.log('🔊 Unlocking audio for iOS...');
    
    // Method 1: Speak empty string
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    this.synthesis.speak(utterance);

    // Method 2: Use AudioContext
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0; // Silent
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(0);
        oscillator.stop(0.001);
        
        // Resume context if suspended
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      }
    } catch (e) {
      console.warn('AudioContext unlock failed:', e);
    }
  }

  destroy(): void {
    this.continuousMode = false;
    this.stopListening();
    this.stopSpeaking();
  }
}

// Type definitions
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
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