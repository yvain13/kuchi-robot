/**
 * Voice Manager using Web Speech API + OpenAI TTS
 * Handles speech recognition (STT) and synthesis (TTS)
 * Uses OpenAI TTS for high-quality voice output on all devices
 * 
 * iOS FIX: Uses pre-warmed audio element pool to maintain user gesture context
 */

export interface VoiceCallbacks {
  onListeningStart?: () => void;
  onListeningEnd?: () => void;
  onSpeechResult?: (text: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onError?: (error: string) => void;
}

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSProvider = 'openai' | 'browser';

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
  private preferredVoiceName: string = '';
  
  // OpenAI TTS Configuration
  private ttsProvider: TTSProvider = 'browser';
  private openaiApiKey: string = '';
  private openaiVoice: OpenAIVoice = 'alloy';
  private openaiSpeed: number = 1.0;
  
  // iOS Audio Fix: Pre-warmed audio element
  private audioElement: HTMLAudioElement | null = null;
  private audioUnlocked: boolean = false;
  private pendingAudioUrl: string | null = null;

  constructor(callbacks: VoiceCallbacks = {}, continuous: boolean = false) {
    this.callbacks = callbacks;
    this.synthesis = window.speechSynthesis;
    this.continuousMode = continuous;
    
    // Detect iOS
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    this.initializeRecognition();
    this.preloadVoices();
    this.initializeAudioElement();
    
    // iOS: Keep synthesis alive by pinging it periodically
    if (this.isIOS) {
      this.keepSynthesisAlive();
    }
  }

  // ==================== Audio Element Initialization ====================

  /**
   * Initialize a reusable audio element
   * This helps maintain user gesture context on iOS
   */
  private initializeAudioElement(): void {
    this.audioElement = new Audio();
    this.audioElement.volume = 1.0;
    
    // Preload silent audio to warm up the element
    this.audioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
    
    this.audioElement.onended = () => {
      console.log('🔊 Audio playback ended');
      this.isSpeaking = false;
      this.callbacks.onSpeakingEnd?.();
      
      if (this.continuousMode) {
        setTimeout(() => this.startListening(), 500);
      }
    };
    
    this.audioElement.onerror = (e) => {
      console.error('🔊 Audio error:', e);
      // Don't set error callback here as it might fire for the silent init
    };
  }

  // ==================== OpenAI TTS Configuration ====================

  /**
   * Enable OpenAI TTS with your API key
   * @param apiKey - Your OpenAI API key
   * @param voice - Voice to use: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
   * @param speed - Speech speed (0.25 to 4.0, default 1.0)
   */
  enableOpenAITTS(apiKey: string, voice: OpenAIVoice = 'alloy', speed: number = 1.0): void {
    this.ttsProvider = 'openai';
    this.openaiApiKey = apiKey;
    this.openaiVoice = voice;
    this.openaiSpeed = Math.max(0.25, Math.min(4.0, speed));
    console.log(`🔊 OpenAI TTS enabled - Voice: ${voice}, Speed: ${this.openaiSpeed}`);
  }

  /**
   * Switch to browser's built-in TTS
   */
  useBrowserTTS(): void {
    this.ttsProvider = 'browser';
    console.log('🔊 Switched to browser TTS');
  }

  /**
   * Set OpenAI voice
   */
  setOpenAIVoice(voice: OpenAIVoice): void {
    this.openaiVoice = voice;
    console.log(`🔊 OpenAI voice set to: ${voice}`);
  }

  /**
   * Set OpenAI speech speed
   */
  setOpenAISpeed(speed: number): void {
    this.openaiSpeed = Math.max(0.25, Math.min(4.0, speed));
  }

  /**
   * Get current TTS provider
   */
  getTTSProvider(): TTSProvider {
    return this.ttsProvider;
  }

  // ==================== Voice Preloading ====================

  /**
   * Preload voices - required for iOS
   */
  private preloadVoices(): void {
    const loadVoices = () => {
      this.cachedVoices = this.synthesis.getVoices();
      if (this.cachedVoices.length > 0) {
        this.voicesLoaded = true;
        console.log(`🔊 Loaded ${this.cachedVoices.length} browser voices`);
      }
    };

    loadVoices();
    this.synthesis.onvoiceschanged = loadVoices;

    if (!this.voicesLoaded) {
      setTimeout(loadVoices, 100);
      setTimeout(loadVoices, 500);
      setTimeout(loadVoices, 1000);
    }
  }

  /**
   * iOS fix: Keep speech synthesis "warm"
   */
  private keepSynthesisAlive(): void {
    setInterval(() => {
      if (!this.isSpeaking && this.ttsProvider === 'browser') {
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        this.synthesis.speak(utterance);
      }
    }, 10000);
  }

  // ==================== Speech Recognition ====================

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

  // ==================== Text-to-Speech ====================

  /**
   * Main speak function - routes to OpenAI or Browser TTS
   */
  speak(text: string): Promise<void> {
    const cleanText = this.cleanTextForSpeech(text);
    
    if (!cleanText) {
      return Promise.resolve();
    }

    // Stop any current speech
    this.stopSpeaking();

    if (this.ttsProvider === 'openai' && this.openaiApiKey) {
      return this.speakWithOpenAI(cleanText);
    } else {
      return this.speakWithBrowser(cleanText);
    }
  }

  /**
   * Speak using OpenAI TTS API
   * iOS FIX: Play audio immediately in user gesture context, then swap source
   */
  private async speakWithOpenAI(text: string): Promise<void> {
    // Check if audio is unlocked
    if (!this.audioUnlocked) {
      console.warn('🔊 Audio not unlocked, falling back to browser TTS');
      return this.speakWithBrowser(text);
    }

    try {
      this.isSpeaking = true;
      if (this.isListening) {
        this.stopListening();
      }
      this.callbacks.onSpeakingStart?.();

      console.log(`🔊 Fetching OpenAI TTS (${this.openaiVoice})...`);

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: this.openaiVoice,
          input: text,
          speed: this.openaiSpeed,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI TTS API error:', errorText);
        throw new Error(`OpenAI TTS failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      console.log('🔊 Playing OpenAI TTS audio...');

      return new Promise<void>((resolve, reject) => {
        if (!this.audioElement) {
          this.audioElement = new Audio();
        }

        // Store URL for cleanup
        this.pendingAudioUrl = audioUrl;

        const onEnded = () => {
          console.log('🔊 OpenAI TTS finished');
          cleanup();
          this.isSpeaking = false;
          this.callbacks.onSpeakingEnd?.();
          
          if (this.continuousMode) {
            setTimeout(() => this.startListening(), 500);
          }
          resolve();
        };

        const onError = (e: Event) => {
          console.error('🔊 Audio playback error:', e);
          cleanup();
          this.isSpeaking = false;
          this.callbacks.onSpeakingEnd?.();
          
          // Fallback to browser TTS
          console.log('🔊 Falling back to browser TTS...');
          this.speakWithBrowser(text).then(resolve).catch(reject);
        };

        const cleanup = () => {
          if (this.audioElement) {
            this.audioElement.removeEventListener('ended', onEnded);
            this.audioElement.removeEventListener('error', onError);
          }
          if (this.pendingAudioUrl) {
            URL.revokeObjectURL(this.pendingAudioUrl);
            this.pendingAudioUrl = null;
          }
        };

        this.audioElement.addEventListener('ended', onEnded, { once: true });
        this.audioElement.addEventListener('error', onError, { once: true });

        this.audioElement.src = audioUrl;
        this.audioElement.load();
        
        // Play with promise handling
        const playPromise = this.audioElement.play();
        
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error('🔊 Play failed:', error);
            cleanup();
            this.isSpeaking = false;
            this.callbacks.onSpeakingEnd?.();
            
            // Fallback to browser TTS
            this.speakWithBrowser(text).then(resolve).catch(reject);
          });
        }
      });

    } catch (error) {
      console.error('OpenAI TTS error:', error);
      this.isSpeaking = false;
      this.callbacks.onSpeakingEnd?.();
      
      // Fallback to browser TTS
      console.log('🔊 Falling back to browser TTS...');
      return this.speakWithBrowser(text);
    }
  }

  /**
   * Speak using Browser's built-in TTS (fallback)
   */
  private speakWithBrowser(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.synthesis.cancel();

      const startSpeech = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = this.isIOS ? 0.9 : 0.95;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        const voice = this.selectBrowserVoice();
        if (voice) {
          utterance.voice = voice;
        }

        utterance.onstart = () => {
          console.log('🔊 Browser TTS started');
          this.isSpeaking = true;
          if (this.isListening) {
            this.stopListening();
          }
          this.callbacks.onSpeakingStart?.();
        };

        utterance.onend = () => {
          console.log('🔊 Browser TTS ended');
          this.isSpeaking = false;
          this.callbacks.onSpeakingEnd?.();

          if (this.continuousMode) {
            setTimeout(() => this.startListening(), 500);
          }

          resolve();
        };

        utterance.onerror = (event) => {
          console.error('🔊 Browser TTS error:', event.error);
          this.isSpeaking = false;

          if (event.error === 'interrupted' || event.error === 'canceled') {
            this.callbacks.onSpeakingEnd?.();
            resolve();
            return;
          }

          this.callbacks.onError?.(`Speech error: ${event.error}`);
          reject(event.error);
        };

        if (this.synthesis.paused) {
          this.synthesis.resume();
        }

        this.synthesis.speak(utterance);

        // iOS fix for speech stopping after ~15 seconds
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

          const resumeTimeout = setTimeout(() => {
            if (this.synthesis.paused) {
              this.synthesis.resume();
            }
          }, 14000);

          utterance.onend = () => {
            clearInterval(checkInterval);
            clearTimeout(resumeTimeout);
            this.isSpeaking = false;
            this.callbacks.onSpeakingEnd?.();
            resolve();
          };
        }
      };

      setTimeout(startSpeech, this.isIOS ? 100 : 50);
    });
  }

  /**
   * Set preferred browser voice by name
   */
  setPreferredVoice(voiceName: string): void {
    this.preferredVoiceName = voiceName;
    console.log(`🔊 Preferred browser voice set to: ${voiceName || 'Auto'}`);
  }

  /**
   * Select the best available browser voice
   */
  private selectBrowserVoice(): SpeechSynthesisVoice | null {
    const voices = this.synthesis.getVoices();
    if (voices.length > 0) {
      this.cachedVoices = voices;
    }

    const availableVoices = this.cachedVoices;

    if (availableVoices.length === 0) {
      return null;
    }

    if (this.preferredVoiceName) {
      const userPreferred = availableVoices.find(v => v.name === this.preferredVoiceName);
      if (userPreferred) return userPreferred;
    }

    if (this.isIOS) {
      const iosPreferred = availableVoices.find(v =>
        v.name.includes('Samantha') ||
        v.name.includes('Karen') ||
        v.name.includes('Daniel') ||
        (v.lang.startsWith('en') && v.localService)
      );
      if (iosPreferred) return iosPreferred;
    }

    const preferred = availableVoices.find(v =>
      v.name.includes('Google') ||
      v.name.includes('Natural') ||
      v.name.includes('Enhanced') ||
      v.name.includes('Premium') ||
      v.name.includes('Microsoft Zira') ||
      v.name.includes('Microsoft David')
    );
    if (preferred) return preferred;

    const englishVoice = availableVoices.find(v => v.lang.startsWith('en'));
    if (englishVoice) return englishVoice;

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

    // Remove special characters
    cleanText = cleanText.replace(/[*#_~`]/g, '');

    // Remove multiple spaces and trim
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return cleanText;
  }

  stopSpeaking(): void {
    this.isSpeaking = false;

    // Stop OpenAI audio
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }

    // Clean up pending URL
    if (this.pendingAudioUrl) {
      URL.revokeObjectURL(this.pendingAudioUrl);
      this.pendingAudioUrl = null;
    }

    // Stop browser TTS
    this.synthesis.cancel();
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

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  static isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  /**
   * iOS: Unlock audio by playing silent sounds
   * MUST be called from a user gesture (like button click)
   * This is CRITICAL for OpenAI TTS to work on iOS!
   */
  unlockAudio(): void {
    console.log('🔊 Unlocking audio...');

    // Method 1: Play silent audio on the reusable element
    // This is the KEY fix for iOS - we play something on the audio element
    // that we'll reuse later, establishing user gesture permission
    if (this.audioElement) {
      this.audioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      this.audioElement.volume = 0.01;
      
      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('🔊 Audio element unlocked successfully!');
            this.audioUnlocked = true;
            this.audioElement?.pause();
          })
          .catch((e) => {
            console.warn('🔊 Audio element unlock failed:', e);
          });
      }
    }

    // Method 2: Create a fresh audio element and play (backup)
    try {
      const tempAudio = new Audio();
      tempAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      tempAudio.volume = 0.01;
      tempAudio.play()
        .then(() => {
          this.audioUnlocked = true;
          tempAudio.pause();
          console.log('🔊 Backup audio unlock successful');
        })
        .catch(() => {});
    } catch (e) {}

    // Method 3: Speak empty string (for Browser TTS fallback)
    try {
      const utterance = new SpeechSynthesisUtterance('');
      utterance.volume = 0;
      this.synthesis.speak(utterance);
    } catch (e) {}

    // Method 4: Use AudioContext
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(0);
        oscillator.stop(0.001);
        
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        console.log('🔊 AudioContext unlocked');
      }
    } catch (e) {
      console.warn('AudioContext unlock failed:', e);
    }

    // Mark as unlocked (optimistic)
    this.audioUnlocked = true;
  }

  /**
   * Check if audio is unlocked
   */
  isAudioUnlocked(): boolean {
    return this.audioUnlocked;
  }

  destroy(): void {
    this.continuousMode = false;
    this.stopListening();
    this.stopSpeaking();
    
    if (this.audioElement) {
      this.audioElement.src = '';
      this.audioElement = null;
    }
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