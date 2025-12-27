/**
 * Kuchi - Music Manager
 * Handles background music playback
 * Respects browser autoplay policies
 */

export class MusicManager {
  private audio: HTMLAudioElement | null = null;
  private isCurrentlyPlaying = false;
  private onMusicEnd?: () => void;
  private hasUserInteracted = false;

  constructor(onMusicEnd?: () => void) {
    this.onMusicEnd = onMusicEnd;
    this.initializeAudio();
    this.setupUserInteractionListener();
  }

  /**
   * Setup listener to detect user interaction
   * Required for browser autoplay policies
   */
  private setupUserInteractionListener(): void {
    const enableAudioPlayback = () => {
      this.hasUserInteracted = true;
      console.log('🎵 User interaction detected - audio playback enabled');
      // Remove listeners after first interaction
      document.removeEventListener('click', enableAudioPlayback);
      document.removeEventListener('touchstart', enableAudioPlayback);
      document.removeEventListener('keydown', enableAudioPlayback);
    };

    document.addEventListener('click', enableAudioPlayback, { once: true });
    document.addEventListener('touchstart', enableAudioPlayback, { once: true });
    document.addEventListener('keydown', enableAudioPlayback, { once: true });
  }

  /**
   * Initialize audio element with the classical music track
   */
  private initializeAudio(): void {
    // Import the music file from assets
    // Vite will handle the asset import and provide the correct URL
    import('./assets/music/classical_music.mp3').then((module) => {
      this.audio = new Audio(module.default);
      this.audio.loop = false; // Play once and stop
      this.audio.volume = 0.5; // 50% volume for background music
      this.audio.preload = 'auto'; // Preload the audio

      // Handle when music ends
      this.audio.addEventListener('ended', () => {
        console.log('🎵 Music finished playing');
        this.isCurrentlyPlaying = false;
        if (this.onMusicEnd) {
          this.onMusicEnd();
        }
      });

      // Handle errors
      this.audio.addEventListener('error', (e) => {
        console.error('🎵 Music playback error:', e);
        this.isCurrentlyPlaying = false;
      });

      console.log('🎵 Music manager initialized');
    }).catch((error) => {
      console.error('🎵 Failed to load music file:', error);
    });
  }

  /**
   * Play the music
   * Requires user interaction in browsers with autoplay policies
   */
  async play(): Promise<void> {
    if (!this.audio) {
      console.warn('🎵 Audio not ready yet');
      return;
    }

    if (this.isCurrentlyPlaying) {
      console.log('🎵 Music already playing');
      return;
    }

    // Check if user has interacted with page (required by browser autoplay policies)
    if (!this.hasUserInteracted) {
      console.warn('🎵 Autoplay not allowed - requires user interaction. Please interact with the page first.');
      // Attempt to play anyway - browser will block it silently or show error
    }

    try {
      // Reset to beginning if was played before
      this.audio.currentTime = 0;

      // Create a promise that resolves when play succeeds
      const playPromise = this.audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isCurrentlyPlaying = true;
            console.log('🎵 Music started playing');
          })
          .catch((error: Error) => {
            console.error('🎵 Failed to play music:', error.message);
            // NotAllowedError: autoplay policy
            // NotSupportedError: format not supported
            if (error.name === 'NotAllowedError') {
              console.warn('🎵 Autoplay blocked by browser policy. User interaction required.');
            }
            this.isCurrentlyPlaying = false;
          });
      } else {
        // Older browsers without Promise support
        this.isCurrentlyPlaying = true;
        console.log('🎵 Music started playing');
      }
    } catch (error) {
      console.error('🎵 Failed to play music:', error);
      this.isCurrentlyPlaying = false;
    }
  }

  /**
   * Stop the music
   */
  stop(): void {
    if (!this.audio) {
      return;
    }

    if (this.isCurrentlyPlaying) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isCurrentlyPlaying = false;
      console.log('🎵 Music stopped');
    }
  }

  /**
   * Check if music is currently playing
   */
  isPlaying(): boolean {
    return this.isCurrentlyPlaying;
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(level: number): void {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, level));
    }
  }

  /**
   * Check if user has interacted with page
   */
  hasUserInteractedWithPage(): boolean {
    return this.hasUserInteracted;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    if (this.audio) {
      this.audio.remove();
      this.audio = null;
    }
  }
}
