/**
 * Kuchi - Music Manager
 * Handles background music playback
 */

export class MusicManager {
  private audio: HTMLAudioElement | null = null;
  private isCurrentlyPlaying = false;
  private onMusicEnd?: () => void;

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

    try {
      // Reset to beginning if was played before
      this.audio.currentTime = 0;

      await this.audio.play();
      this.isCurrentlyPlaying = true;
      console.log('🎵 Music started playing');
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
