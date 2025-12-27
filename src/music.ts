/**
 * Kuchi - Music Manager
 * Handles background music playback
 * Respects browser autoplay policies
 */

export class MusicManager {
  private audio: HTMLAudioElement | null = null;
  private isCurrentlyPlaying = false;
  private onMusicEnd?: () => void;
  private audioContextWarmedUp = false;

  constructor(onMusicEnd?: () => void) {
    this.onMusicEnd = onMusicEnd;
    this.initializeAudio();
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
   * Warm up audio context for playback
   * MUST be called from a user gesture (click, touch, keypress)
   * This prepares the browser to allow audio playback
   */
  warmUpAudio(): void {
    if (this.audioContextWarmedUp) {
      console.log('🎵 Audio context already warmed up');
      return;
    }

    if (!this.audio) {
      console.warn('🎵 Audio not ready yet, skipping warmup');
      return;
    }

    try {
      // Create a silent audio element and play it briefly
      // This tricks the browser into unlocking audio playback
      const silentAudio = new Audio();
      silentAudio.volume = 0; // Silent
      
      const playPromise = silentAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            silentAudio.pause();
            silentAudio.currentTime = 0;
            this.audioContextWarmedUp = true;
            console.log('🎵 Audio context warmed up successfully');
          })
          .catch((error) => {
            console.log('�� Warmup attempt (expected to fail silently):', error.name);
          });
      }
    } catch (error) {
      console.log('🎵 Warmup error (expected):', error);
    }
  }

  /**
   * Play the music
   * Should be called after warmUpAudio() has been triggered
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

    if (!this.audioContextWarmedUp) {
      console.warn('�� Audio context not warmed up yet. Click mic first to enable audio.');
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
            if (error.name === 'NotAllowedError') {
              console.warn('🎵 Autoplay blocked. Try clicking the mic button first.');
            } else if (error.name === 'NotSupportedError') {
              console.warn('🎵 Audio format not supported.');
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
   * Check if audio context is warmed up
   */
  isAudioContextWarmedUp(): boolean {
    return this.audioContextWarmedUp;
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
