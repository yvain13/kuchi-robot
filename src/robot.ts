/**
 * Kuchi - Vector/Cozmo Style Robot Face
 * Clean cyan LED eyes on dark screen
 * Expression conveyed purely through eye shapes - no mouth
 */

export type Expression =
  // Basic states
  | 'neutral'
  | 'idle'
  | 'blink'
  // Positive emotions
  | 'happy'
  | 'glee'
  | 'love'
  | 'excited'
  | 'awe'
  // Negative emotions
  | 'sad'
  | 'worried'
  | 'angry'
  | 'furious'
  | 'scared'
  | 'frustrated'
  // Complex emotions
  | 'surprised'
  | 'confused'
  | 'skeptic'
  | 'suspicious'
  | 'unimpressed'
  | 'annoyed'
  | 'sleepy'
  | 'squint'
  | 'focused'
  | 'pleading'
  | 'wink'
  // Interaction states
  | 'listening'
  | 'thinking'
  | 'speaking' // Will show a positive expression, not mouth animation
  | 'error'
  | 'dead'
  // Look directions
  | 'lookLeft'
  | 'lookRight'
  | 'lookUp'
  | 'lookDown';

export class RobotFace {
  private container: HTMLElement;
  private currentExpression: Expression = 'neutral';
  private blinkInterval: number | null = null;
  private isBlinking = false;
  private isSpeaking = false;
  private inactivityTimer: number | null = null;
  private lastActivityTime: number = Date.now();
  private isSleeping = false;
  private sleepTimeout: number = 120000; // 2 minutes in milliseconds

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Element with id "${containerId}" not found`);
    }
    this.container = element;
    this.createRobot();
    this.setExpression('neutral');
    this.startBlinking();
    this.startIdleAnimations();
    this.startInactivityMonitor();
  }

  private createRobot(): void {
    this.container.innerHTML = `
      <div class="kuchi-bot" id="kuchiBot">
        <!-- Head -->
        <div class="head">
          <div class="antenna"></div>
          <div class="helmet">
            <div class="ear left"></div>
            <div class="ear right"></div>
            <div class="face-plate"></div>
            <div class="screen">
              <div class="face" id="face">
                <!-- Vector-style eyes - just two cyan rectangles -->
                <div class="eyes-container">
                  <div class="eye left"></div>
                  <div class="eye right"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="body" id="body">
          <div class="arm left"></div>
          <div class="chassis">
            <div class="chest-plate"></div>
          </div>
          <div class="arm right"></div>
        </div>

        <!-- Treads -->
        <div class="treads">
          <div class="tread">
            <div class="wheel top"></div>
            <div class="tread-lines">
              <div class="tread-line"></div>
              <div class="tread-line"></div>
              <div class="tread-line"></div>
              <div class="tread-line"></div>
            </div>
            <div class="wheel bottom"></div>
          </div>
          <div class="tread">
            <div class="wheel top"></div>
            <div class="tread-lines">
              <div class="tread-line"></div>
              <div class="tread-line"></div>
              <div class="tread-line"></div>
              <div class="tread-line"></div>
            </div>
            <div class="wheel bottom"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Set the robot's facial expression
   * No mouth animation - expression stays fixed during speech
   */
  setExpression(expression: Expression): void {
    // Don't interrupt blink animation
    if (this.isBlinking && expression !== 'blink') {
      return;
    }

    this.currentExpression = expression;
    const face = this.container.querySelector('.face') as HTMLElement;
    const body = this.container.querySelector('.body') as HTMLElement;

    if (!face || !body) return;

    // Remove all expression classes
    const allExpressions = [
      'expr-neutral', 'expr-idle', 'expr-blink',
      'expr-happy', 'expr-glee', 'expr-love', 'expr-excited', 'expr-awe',
      'expr-sad', 'expr-worried', 'expr-angry', 'expr-furious', 'expr-scared', 'expr-frustrated',
      'expr-surprised', 'expr-confused', 'expr-skeptic', 'expr-suspicious',
      'expr-unimpressed', 'expr-annoyed', 'expr-sleepy', 'expr-squint', 'expr-focused',
      'expr-pleading', 'expr-wink',
      'expr-listening', 'expr-thinking', 'expr-speaking', 'expr-error', 'expr-dead',
      'expr-lookLeft', 'expr-lookRight', 'expr-lookUp', 'expr-lookDown'
    ];
    
    allExpressions.forEach(cls => face.classList.remove(cls));
    body.classList.remove('wave');

    // Add new expression class
    if (expression && expression !== 'neutral' && expression !== 'idle') {
      face.classList.add(`expr-${expression}`);
    }

    // Body animations for positive emotions
    if (['happy', 'glee', 'excited', 'love', 'awe'].includes(expression)) {
      body.classList.add('wave');
    }

    console.log(`🤖 Expression: ${expression}`);
  }

  /**
   * Start blinking animation
   */
  private startBlinking(): void {
    const blink = () => {
      // Don't blink during certain expressions
      const noBlinkExpressions: Expression[] = [
        'blink', 'happy', 'glee', 'sleepy', 'squint', 'wink',
        'annoyed', 'focused', 'frustrated', 'error', 'dead',
        'angry', 'furious', 'love'
      ];

      if (noBlinkExpressions.includes(this.currentExpression)) {
        this.scheduleNextBlink();
        return;
      }

      // Perform blink
      this.isBlinking = true;
      const face = this.container.querySelector('.face') as HTMLElement;

      if (face) {
        face.classList.add('expr-blink');
      }

      // Restore after blink
      setTimeout(() => {
        if (face) {
          face.classList.remove('expr-blink');
        }
        this.isBlinking = false;
      }, 150);

      this.scheduleNextBlink();
    };

    this.scheduleNextBlink = () => {
      const nextBlink = Math.random() * 4000 + 2000; // 2-6 seconds
      this.blinkInterval = window.setTimeout(blink, nextBlink);
    };

    this.scheduleNextBlink();
  }

  private scheduleNextBlink: () => void = () => {};

  /**
   * Subtle idle animations with more variety
   */
  private startIdleAnimations(): void {
    // Occasional look around when idle
    const idleLook = () => {
      if (this.isSleeping) return; // Don't animate while sleeping

      if (this.currentExpression === 'neutral' || this.currentExpression === 'idle') {
        // More varied idle behaviors
        const behaviors = [
          { expr: 'lookLeft' as Expression, duration: 800 },
          { expr: 'lookRight' as Expression, duration: 800 },
          { expr: 'lookUp' as Expression, duration: 1000 },
          { expr: 'lookDown' as Expression, duration: 700 },
          { expr: 'blink' as Expression, duration: 150 },
          { expr: 'squint' as Expression, duration: 600 },
          { expr: 'neutral' as Expression, duration: 500 }
        ];

        const randomBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];

        // Brief expression
        this.setExpression(randomBehavior.expr);

        setTimeout(() => {
          if (!this.isSleeping && this.currentExpression === randomBehavior.expr) {
            this.setExpression('neutral');
          }
        }, randomBehavior.duration + Math.random() * 500);
      }
    };

    // Run occasionally
    setInterval(() => {
      if (Math.random() > 0.6) {
        idleLook();
      }
    }, 5000);
  }

  /**
   * Monitor inactivity and trigger sleep state
   */
  private startInactivityMonitor(): void {
    const checkInactivity = () => {
      const now = Date.now();
      const timeSinceActivity = now - this.lastActivityTime;

      if (timeSinceActivity >= this.sleepTimeout && !this.isSleeping && !this.isSpeaking) {
        this.enterSleepMode();
      }
    };

    // Check every 10 seconds
    this.inactivityTimer = window.setInterval(checkInactivity, 10000);
  }

  /**
   * Enter sleep mode with sleepy expression and zzz animation
   */
  private enterSleepMode(): void {
    this.isSleeping = true;
    this.setExpression('sleepy');

    // Add zzz animation to the face
    const screen = this.container.querySelector('.screen') as HTMLElement;
    if (screen && !screen.querySelector('.sleeping-zzz')) {
      const zzzContainer = document.createElement('div');
      zzzContainer.className = 'sleeping-zzz';
      zzzContainer.innerHTML = `
        <span class="zzz z1">z</span>
        <span class="zzz z2">z</span>
        <span class="zzz z3">z</span>
      `;
      screen.appendChild(zzzContainer);
    }

    console.log('💤 Kuchi is sleeping...');
  }

  /**
   * Wake up from sleep mode
   */
  wakeUp(): void {
    if (!this.isSleeping) return;

    this.isSleeping = false;
    this.lastActivityTime = Date.now();

    // Remove zzz animation
    const zzzContainer = this.container.querySelector('.sleeping-zzz');
    if (zzzContainer) {
      zzzContainer.remove();
    }

    // Show surprised expression briefly when woken up
    this.setExpression('surprised');
    setTimeout(() => {
      if (!this.isSpeaking) {
        this.setExpression('neutral');
      }
    }, 1000);

    console.log('👀 Kuchi woke up!');
  }

  /**
   * Reset activity timer (call this on any user interaction)
   */
  resetActivity(): void {
    const wasSleeping = this.isSleeping;
    this.lastActivityTime = Date.now();

    if (wasSleeping) {
      this.wakeUp();
    }
  }

  /**
   * Analyze text sentiment and return appropriate expression
   * Used to set expression during speech - expression stays fixed while speaking
   */
  getExpressionFromSentiment(text: string): Expression {
    const lower = text.toLowerCase();

    // Positive emotions
    if (lower.match(/(love|adore|heart|romantic|dear|sweet)/i)) return 'love';
    if (lower.match(/(haha|lol|rofl|lmao|hilarious|😂|🤣)/i)) return 'glee';
    if (lower.match(/(wow|amazing|incredible|awesome|fantastic|wonderful|brilliant)/i)) return 'awe';
    if (lower.match(/(excited|can't wait|thrilled|pumped|yay|woohoo)/i)) return 'excited';
    if (lower.match(/(great|good|nice|happy|glad|pleased|excellent|perfect)/i)) return 'happy';
    
    // Negative emotions
    if (lower.match(/(sorry|apologize|unfortunately|sad|regret)/i)) return 'sad';
    if (lower.match(/(worried|concern|anxious|nervous)/i)) return 'worried';
    if (lower.match(/(angry|mad|furious|outraged)/i)) return 'angry';
    if (lower.match(/(scared|afraid|terrified|frightened)/i)) return 'scared';
    if (lower.match(/(frustrated|annoying|ugh)/i)) return 'frustrated';
    
    // Complex emotions
    if (lower.match(/(error|fail|wrong|broken|can't|cannot|unable)/i)) return 'worried';
    if (lower.match(/(confused|unclear|don't understand|what do you mean)/i)) return 'confused';
    if (lower.match(/(really\?|seriously\?|hmm|skeptical)/i)) return 'skeptic';
    if (lower.match(/(suspicious|doubt|not sure)/i)) return 'suspicious';
    if (lower.match(/(think|consider|let me see|hmm|processing)/i)) return 'thinking';
    if (lower.match(/(surprise|what\?!|no way|oh my)/i)) return 'surprised';
    if (lower.match(/(sleepy|tired|yawn|exhausted)/i)) return 'sleepy';
    if (lower.match(/(focus|concentrate|important|attention)/i)) return 'focused';
    if (lower.match(/(please|help|need|beg)/i)) return 'pleading';
    
    // Default to happy for neutral/positive responses
    if (lower.match(/(here|is|the|this|that|yes|sure|okay|ok|alright)/i)) return 'happy';
    
    return 'neutral';
  }

  /**
   * Get current expression
   */
  getCurrentExpression(): Expression {
    return this.currentExpression;
  }

  /**
   * Set speaking state - expression stays fixed, no mouth animation
   */
  setSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking;
  }

  /**
   * Check if currently speaking
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.blinkInterval) {
      clearTimeout(this.blinkInterval);
    }
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
    }
  }
}