/**
 * Kuchi - Voice-Activated Robot Assistant
 * Vector/Cozmo style - expression stays fixed during speech
 */

import { RobotFace, Expression } from './robot';
import { VoiceManager } from './voice';
import { KuchiAgent } from './openai';
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
  private agent: KuchiAgent | null = null;

  // DOM Elements
  private micBtn: HTMLButtonElement;
  private statusText: HTMLElement;
  private settingsBtn: HTMLButtonElement;
  private settingsModal: HTMLElement;
  private apiKeyInput: HTMLInputElement;
  private serpApiKeyInput: HTMLInputElement;
  private saveBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;

  // State
  private appState: AppState = 'idle';
  private speakingExpression: Expression = 'happy';
  private readonly API_KEY_STORAGE = 'kuchi_api_key';
  private readonly SERP_API_KEY_STORAGE = 'kuchi_serp_api_key';

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

    // Initialize agent
    this.initializeAgent();
    this.setupEventListeners();
    this.checkBrowserSupport();

    this.micBtn.style.display = 'flex';
    console.log('✅ Kuchi initialized (Vector Style)');
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
    this.apiKeyInput.value = apiKey || '';
    this.serpApiKeyInput.value = serpApiKey || '';
    this.settingsModal.classList.remove('hidden');
    this.apiKeyInput.focus();
  }

  private closeSettings(): void {
    this.settingsModal.classList.add('hidden');
  }

  private saveSettings(): void {
    const apiKey = this.apiKeyInput.value.trim();
    const serpApiKey = this.serpApiKeyInput.value.trim();

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

    try {
      this.agent = new KuchiAgent(apiKey, serpApiKey);
      this.updateStatus('Ready! Tap to speak');
      this.robotFace.setExpression('happy');
      
      setTimeout(() => {
        this.closeSettings();
        this.robotFace.setExpression('neutral');
      }, 1000);

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