/**
 * Kuchi - Voice-Activated Robot Assistant
 * Vector/Cozmo style - expression stays fixed during speech
 */

import { RobotFace, Expression } from './robot';
import { VoiceManager } from './voice';
import { KuchiAgent } from './openai';
import { DragManager } from './interactions';
import { MusicManager } from './music';
import './styles.css';

type AppState = 
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

class KuchiApp {
  private robotFace: RobotFace;
  private voiceManager: VoiceManager;
  private dragManager: DragManager;
  private musicManager: MusicManager;
  private agent: KuchiAgent | null = null;

  // DOM Elements
  private micBtn: HTMLButtonElement;
  private statusText: HTMLElement;
  private settingsBtn: HTMLButtonElement;
  private settingsModal: HTMLElement;
  private apiKeyInput: HTMLInputElement;
  private serpApiKeyInput: HTMLInputElement;
  private voiceSelect: HTMLSelectElement;
  private userNameInput: HTMLInputElement;
  private memoryNotesInput: HTMLTextAreaElement;
  private saveBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;

  // State
  private appState: AppState = 'idle';
  private speakingExpression: Expression = 'happy';
  private readonly API_KEY_STORAGE = 'kuchi_api_key';
  private readonly SERP_API_KEY_STORAGE = 'kuchi_serp_api_key';
  private readonly VOICE_STORAGE = 'kuchi_selected_voice';

  constructor() {
    console.log('🤖 Initializing Kuchi (Vector Style)...');

    // Initialize robot face
    this.robotFace = new RobotFace('robotFace');

    // Get DOM elements
    this.micBtn = document.getElementById('micBtn') as HTMLButtonElement;
    this.statusText = document.getElementById('statusText') as HTMLElement;
    this.settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;
    this.settingsModal = document.getElementById('settingsModal') as HTMLElement;
    this.apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
    this.serpApiKeyInput = document.getElementById('serpApiKeyInput') as HTMLInputElement;
    this.voiceSelect = document.getElementById('voiceSelect') as HTMLSelectElement;
    this.userNameInput = document.getElementById('userNameInput') as HTMLInputElement;
    this.memoryNotesInput = document.getElementById('memoryNotesInput') as HTMLTextAreaElement;
    this.saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;

    // Initialize voice manager
    this.voiceManager = new VoiceManager(
      {
        onListeningStart: () => this.handleListeningStart(),
        onListeningEnd: () => this.handleListeningEnd(),
        onSpeechResult: (text) => this.handleSpeechResult(text),
        onSpeakingStart: () => this.handleSpeakingStart(),
        onSpeakingEnd: () => this.handleSpeakingEnd(),
        onError: (error) => this.handleError(error),
      },
      false
    );

    // Initialize drag manager with interaction callbacks
    // Target 'robotFace' container instead of 'kuchiBot' for proper dragging
    this.dragManager = new DragManager('robotFace', {
      onDragStart: () => this.handleDragStart(),
      onDragMove: (velocity) => this.handleDragMove(velocity),
      onDragEnd: () => this.handleDragEnd(),
      onZoneTap: (zone) => this.handleZoneTap(zone),
    });

    // Initialize music manager
    this.musicManager = new MusicManager(() => {
      // When music ends, return to neutral state
      if (this.appState !== 'listening' && this.appState !== 'speaking') {
        this.robotFace.setExpression('neutral');
        this.updateStatus('Tap to speak');
      }
    });

    // Load saved voice preference
    const savedVoice = localStorage.getItem(this.VOICE_STORAGE);
    if (savedVoice) {
      this.voiceManager.setPreferredVoice(savedVoice);
    }

    // Initialize agent
    this.initializeAgent();
    this.setupEventListeners();
    this.checkBrowserSupport();
    this.loadVoices();

    this.micBtn.style.display = 'flex';
    console.log('✅ Kuchi initialized (Vector Style)');
  }

  private loadVoices(): void {
    // Force speech synthesis to wake up and load voices
    if (window.speechSynthesis.getVoices().length === 0) {
      console.log('🔄 Triggering voice load...');
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    }

    this.populateVoiceList();

    // Also listen for voiceschanged event (iOS premium voices load async)
    window.speechSynthesis.onvoiceschanged = () => {
      console.log('🔄 Voices changed event fired');
      this.populateVoiceList();
    };

    // Fallback: Try loading after delays (iOS needs more time for premium voices)
    setTimeout(() => this.populateVoiceList(), 100);
    setTimeout(() => this.populateVoiceList(), 500);
    setTimeout(() => this.populateVoiceList(), 1000);
    setTimeout(() => this.populateVoiceList(), 2000);
    setTimeout(() => this.populateVoiceList(), 3000);
  }

  private populateVoiceList(): void {
    const voices = window.speechSynthesis.getVoices();

    if (voices.length === 0) {
      console.log('⏳ No voices available yet...');
      return;
    }

    // Clear existing options
    this.voiceSelect.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Auto (Recommended)';
    this.voiceSelect.appendChild(defaultOption);

    // Separate premium and regular voices
    const premiumVoices = voices.filter(v =>
      v.lang.startsWith('en') && (v.name.includes('Premium') || v.name.includes('Enhanced'))
    );
    const regularEnglishVoices = voices.filter(v =>
      v.lang.startsWith('en') && !v.name.includes('Premium') && !v.name.includes('Enhanced')
    );
    const otherVoices = voices.filter(v => !v.lang.startsWith('en'));

    // Add Premium voices first (if any)
    if (premiumVoices.length > 0) {
      const premiumGroup = document.createElement('optgroup');
      premiumGroup.label = '⭐ Premium English Voices';
      premiumVoices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} ${voice.localService ? '✓' : '(Remote)'}`;
        premiumGroup.appendChild(option);
      });
      this.voiceSelect.appendChild(premiumGroup);
      console.log(`⭐ Found ${premiumVoices.length} premium voices`);
    }

    // Add regular English voices
    if (regularEnglishVoices.length > 0) {
      const enGroup = document.createElement('optgroup');
      enGroup.label = 'English Voices';
      regularEnglishVoices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})${voice.localService ? ' - Local' : ''}`;
        enGroup.appendChild(option);
      });
      this.voiceSelect.appendChild(enGroup);
    }

    // Add other voices
    if (otherVoices.length > 0) {
      const otherGroup = document.createElement('optgroup');
      otherGroup.label = 'Other Languages';
      otherVoices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})${voice.localService ? ' - Local' : ''}`;
        otherGroup.appendChild(option);
      });
      this.voiceSelect.appendChild(otherGroup);
    }

    // Load saved voice preference
    const savedVoice = localStorage.getItem(this.VOICE_STORAGE);
    if (savedVoice) {
      this.voiceSelect.value = savedVoice;
    }

    console.log(`📢 Loaded ${voices.length} voices (${premiumVoices.length} premium, ${regularEnglishVoices.length} regular English)`);
  }

  private setupEventListeners(): void {
    this.micBtn.addEventListener('click', () => this.handleMicClick());
    this.settingsBtn.addEventListener('click', () => this.openSettings());
    this.saveBtn.addEventListener('click', () => this.saveSettings());
    this.cancelBtn.addEventListener('click', () => this.closeSettings());

    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) {
        this.closeSettings();
      }
    });

    this.apiKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.serpApiKeyInput.focus();
      }
    });

    this.serpApiKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveSettings();
      }
    });

    // Spacebar shortcut
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && 
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.handleMicClick();
      }
    });
  }

  private initializeAgent(): void {
    const apiKey = localStorage.getItem(this.API_KEY_STORAGE);
    const serpApiKey = localStorage.getItem(this.SERP_API_KEY_STORAGE);

    if (apiKey && serpApiKey) {
      try {
        this.agent = new KuchiAgent(apiKey, serpApiKey);
        this.updateStatus('Tap to speak');
        this.robotFace.setExpression('neutral');
      } catch (error) {
        console.error('Failed to initialize agent:', error);
        this.updateStatus('Configuration error');
        this.robotFace.setExpression('confused');
      }
    } else {
      this.updateStatus('Configure API keys in ⚙️');
      this.robotFace.setExpression('pleading');
    }
  }

  private checkBrowserSupport(): void {
    if (!VoiceManager.isSupported()) {
      this.updateStatus('⚠️ Use Chrome or Edge');
      this.micBtn.disabled = true;
      this.robotFace.setExpression('error');
    }
  }

  private handleMicClick(): void {
    // iOS: Unlock audio on first tap (must be in user gesture handler)
    this.voiceManager.unlockAudio();

    // Warm up audio context for music playback
    this.musicManager.warmUpAudio();
    // Stop any playing music when mic is clicked
    if (this.musicManager.isPlaying()) {
      this.musicManager.stop();
      this.robotFace.setExpression('neutral');
      this.updateStatus('Music stopped');
      console.log('🎵 Music stopped by user');
    }

    if (this.appState === 'processing' || this.appState === 'speaking') {
      return;
    }

    if (this.appState === 'listening') {
      this.voiceManager.stopListening();
      this.setState('idle');
      return;
    }

    if (!this.agent) {
      this.updateStatus('Configure API keys first');
      this.robotFace.setExpression('pleading');
      this.openSettings();
      return;
    }

    this.setState('listening');
    this.micBtn.classList.add('listening');
    this.voiceManager.startListening();
  }

  private handleListeningStart(): void {
    this.setState('listening');
    this.robotFace.setExpression('listening');
    this.updateStatus('Listening...');
  }

  private handleListeningEnd(): void {
    this.micBtn.classList.remove('listening');
    
    if (this.appState === 'listening') {
      this.setState('idle');
      this.robotFace.setExpression('neutral');
      this.updateStatus('Tap to speak');
    }
  }

  private async handleSpeechResult(text: string): Promise<void> {
    console.log('👤 User:', text);

    if (!text.trim()) {
      this.handleError('No speech detected');
      return;
    }

    if (!this.agent) {
      this.handleError('Configure API keys');
      this.openSettings();
      return;
    }

    // Processing state
    this.setState('processing');
    this.robotFace.setExpression('thinking');
    this.updateStatus('Thinking...');

    try {
      // Get response
      const response = await this.agent.sendMessage(text);
      console.log('🤖 Kuchi:', response);

      // Check if this is a music playback request
      if (response.includes('🎵PLAY_MUSIC🎵')) {
        // Speak confirmation first
        const confirmationMessage = "Sure! Let me play some music for you.";
        this.speakingExpression = 'excited';
        this.robotFace.setExpression(this.speakingExpression);
        this.robotFace.setSpeaking(true);
        this.setState('speaking');
        this.updateStatus('Speaking...');
        await this.voiceManager.speak(confirmationMessage);

        // Play music in background and show love expression
        this.handlePlayMusic();

        // Add context to agent's memory that music is playing
        if (this.agent) {
          await this.agent.sendMessage('[SYSTEM: Music is now playing in the background]');
        }

        return;
      }

      // Determine expression based on sentiment
      // This expression will stay FIXED during the entire speech
      this.speakingExpression = this.robotFace.getExpressionFromSentiment(response);

      // Set the expression BEFORE speaking starts
      this.robotFace.setExpression(this.speakingExpression);
      this.robotFace.setSpeaking(true);

      this.setState('speaking');
      this.updateStatus('Speaking...');

      // Speak - expression stays fixed, no mouth animation
      await this.voiceManager.speak(response);

    } catch (error: any) {
      console.error('Error:', error);
      this.handleError(error.message || 'Request failed');
    }
  }

  private handleSpeakingStart(): void {
    this.setState('speaking');
    this.updateStatus('Speaking...');
    // Expression is already set from sentiment analysis
    // It stays fixed - no animation during speech
  }

  private handleSpeakingEnd(): void {
    this.robotFace.setSpeaking(false);
    this.setState('idle');
    
    // Brief delay before returning to neutral
    setTimeout(() => {
      if (this.appState === 'idle') {
        this.robotFace.setExpression('neutral');
        this.updateStatus('Tap to speak');
      }
    }, 500);
  }

  private handleError(error: string): void {
    if (error.toLowerCase().includes('no speech')) {
      this.setState('idle');
      this.robotFace.setExpression('neutral');
      this.updateStatus('Tap to speak');
      this.micBtn.classList.remove('listening');
      return;
    }

    console.error('❌ Error:', error);
    this.setState('error');
    this.robotFace.setExpression('worried');
    this.updateStatus(this.truncateError(error));
    this.micBtn.classList.remove('listening');

    setTimeout(() => {
      if (this.appState === 'error') {
        this.setState('idle');
        this.robotFace.setExpression('neutral');
        this.updateStatus('Tap to speak');
      }
    }, 4000);
  }

  private truncateError(error: string): string {
    const maxLength = 40;
    return error.length > maxLength ? error.substring(0, maxLength) + '...' : error;
  }

  private setState(state: AppState): void {
    this.appState = state;
  }

  private updateStatus(text: string): void {
    this.statusText.textContent = text;
  }

  private openSettings(): void {
    const apiKey = localStorage.getItem(this.API_KEY_STORAGE);
    const serpApiKey = localStorage.getItem(this.SERP_API_KEY_STORAGE);
    const selectedVoice = localStorage.getItem(this.VOICE_STORAGE);

    this.apiKeyInput.value = apiKey || '';
    this.serpApiKeyInput.value = serpApiKey || '';

    // Load memory data if agent exists
    if (this.agent) {
      const memory = this.agent.getMemory();
      if (memory) {
        this.userNameInput.value = memory.user.name || '';
        this.memoryNotesInput.value = memory.user.notes.join('\n');
      }
    }

    // Refresh voices when settings open (helps iOS premium voices appear)
    console.log('⚙️ Opening settings - refreshing voices...');
    this.populateVoiceList();

    // Also set saved voice after population
    if (selectedVoice) {
      this.voiceSelect.value = selectedVoice;
    }

    this.settingsModal.classList.remove('hidden');
    this.apiKeyInput.focus();
  }

  private closeSettings(): void {
    this.settingsModal.classList.add('hidden');
  }

  /**
   * Handle drag start - reset activity timer and disable dragging during interactions
   */
  private handleDragStart(): void {
    // Reset activity (wake up if sleeping)
    this.robotFace.resetActivity();

    // Disable dragging during listening/speaking
    if (this.appState === 'listening' || this.appState === 'speaking' || this.appState === 'processing') {
      this.dragManager.setEnabled(false);
      return;
    }
  }

  /**
   * Handle drag move - detect velocity and trigger emotional responses
   */
  private handleDragMove(velocity: number): void {
    // Reset activity timer
    this.robotFace.resetActivity();

    // Only react to velocity when idle
    if (this.appState !== 'idle') return;

    // Velocity thresholds (pixels per millisecond)
    const ANNOYED_THRESHOLD = 2.0;
    const FURIOUS_THRESHOLD = 4.0;

    if (velocity > FURIOUS_THRESHOLD) {
      if (this.robotFace.getCurrentExpression() !== 'furious') {
        this.robotFace.setExpression('furious');
        this.updateStatus('Whoa! Too fast!');
      }
    } else if (velocity > ANNOYED_THRESHOLD) {
      if (this.robotFace.getCurrentExpression() !== 'annoyed') {
        this.robotFace.setExpression('annoyed');
        this.updateStatus('Hey, careful!');
      }
    }
  }

  /**
   * Handle drag end - return to neutral after dragging
   */
  private handleDragEnd(): void {
    // Re-enable dragging
    this.dragManager.setEnabled(true);

    // Return to neutral after a brief delay
    setTimeout(() => {
      if (this.appState === 'idle' &&
          (this.robotFace.getCurrentExpression() === 'annoyed' ||
           this.robotFace.getCurrentExpression() === 'furious')) {
        this.robotFace.setExpression('neutral');
        this.updateStatus('Tap to speak');
      }
    }, 1500);
  }

  /**
   * Handle zone tap - different reactions based on where user tapped
   */
  private handleZoneTap(zone: string): void {
    console.log('👆 Tapped zone:', zone);

    // Reset activity
    this.robotFace.resetActivity();

    // Only react to taps when idle
    if (this.appState !== 'idle') return;

    switch (zone) {
      case 'head':
        // Head tap makes Kuchi happy
        this.robotFace.setExpression('happy');
        this.updateStatus('Hehe! That tickles!');
        setTimeout(() => {
          if (this.appState === 'idle') {
            this.robotFace.setExpression('neutral');
            this.updateStatus('Tap to speak');
          }
        }, 2000);
        break;

      case 'body':
        // Body tap makes Kuchi curious
        this.robotFace.setExpression('surprised');
        this.updateStatus('What was that?');
        setTimeout(() => {
          if (this.appState === 'idle') {
            this.robotFace.setExpression('neutral');
            this.updateStatus('Tap to speak');
          }
        }, 1500);
        break;

      case 'arm-left':
      case 'arm-right':
        // Arm tap makes Kuchi wave
        this.robotFace.setExpression('glee');
        this.updateStatus('Hello there!');
        setTimeout(() => {
          if (this.appState === 'idle') {
            this.robotFace.setExpression('neutral');
            this.updateStatus('Tap to speak');
          }
        }, 1500);
        break;
    }
  }

  /**
   * Handle music playback
   */
  private handlePlayMusic(): void {
    console.log('🎵 Starting music playback');

    // Show love expression while enjoying music
    this.robotFace.setExpression('love');
    this.updateStatus('🎵 Enjoying music...');

    // Play music in background
    this.musicManager.play();
  }

  private saveSettings(): void {
    const apiKey = this.apiKeyInput.value.trim();
    const serpApiKey = this.serpApiKeyInput.value.trim();
    const selectedVoice = this.voiceSelect.value;
    const userName = this.userNameInput.value.trim();
    const memoryNotes = this.memoryNotesInput.value.trim();

    if (!apiKey) {
      alert('Please enter an OpenAI API key');
      this.apiKeyInput.focus();
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      alert('Invalid OpenAI API key format');
      this.apiKeyInput.focus();
      return;
    }

    if (!serpApiKey) {
      alert('Please enter a SerpAPI key');
      this.serpApiKeyInput.focus();
      return;
    }

    localStorage.setItem(this.API_KEY_STORAGE, apiKey);
    localStorage.setItem(this.SERP_API_KEY_STORAGE, serpApiKey);
    localStorage.setItem(this.VOICE_STORAGE, selectedVoice);

    // Update voice manager with selected voice
    this.voiceManager.setPreferredVoice(selectedVoice);

    try {
      // Create or update agent
      const wasExisting = this.agent !== null;
      if (!wasExisting) {
        this.agent = new KuchiAgent(apiKey, serpApiKey);
      }

      // Wait a moment for agent to initialize, then update memory
      setTimeout(() => {
        if (this.agent) {
          // Update memory with user inputs
          if (userName) {
            this.agent.updateUserName(userName);
          }
          if (memoryNotes) {
            this.agent.updateUserNotes(memoryNotes);
          }

          // Refresh the system prompt with new memory
          this.agent.refreshSystemPrompt();
        }

        this.updateStatus('Settings saved! Tap to speak');
        this.robotFace.setExpression('happy');

        setTimeout(() => {
          this.closeSettings();
          this.robotFace.setExpression('neutral');
        }, 1000);
      }, wasExisting ? 0 : 500);

    } catch (error) {
      alert('Failed to initialize. Check your API keys.');
      this.robotFace.setExpression('error');
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new KuchiApp();
});