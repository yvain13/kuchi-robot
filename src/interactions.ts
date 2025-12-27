/**
 * Kuchi - Interaction Manager
 * Handles dragging, touch zones, and physical interactions
 */

export interface TouchZone {
  element: HTMLElement;
  zone: 'head' | 'body' | 'arm-left' | 'arm-right';
}

export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
  velocity: number;
  lastMoveTime: number;
}

export class DragManager {
  private element: HTMLElement;
  private dragState: DragState;
  private touchZones: TouchZone[] = [];
  private onDragStart?: () => void;
  private onDragMove?: (velocity: number) => void;
  private onDragEnd?: () => void;
  private onZoneTap?: (zone: string) => void;
  private storageKey = 'kuchi_position';
  private dragStartPosition = { x: 0, y: 0 };
  private dragStartTime = 0;

  // Drag constraints
  private readonly MAX_DRAG_X = 200; // pixels
  private readonly MAX_DRAG_Y = 200; // pixels

  constructor(
    elementId: string,
    callbacks?: {
      onDragStart?: () => void;
      onDragMove?: (velocity: number) => void;
      onDragEnd?: () => void;
      onZoneTap?: (zone: string) => void;
    }
  ) {
    const el = document.getElementById(elementId);
    if (!el) {
      throw new Error(`Element with id "${elementId}" not found`);
    }
    this.element = el;

    this.dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      offsetX: 0,
      offsetY: 0,
      velocity: 0,
      lastMoveTime: 0
    };

    // Assign callbacks
    this.onDragStart = callbacks?.onDragStart;
    this.onDragMove = callbacks?.onDragMove;
    this.onDragEnd = callbacks?.onDragEnd;
    this.onZoneTap = callbacks?.onZoneTap;

    this.initializeTouchZones();
    this.attachEventListeners();
    this.loadSavedPosition();
  }

  /**
   * Initialize touch zones for different body parts
   */
  private initializeTouchZones(): void {
    const head = this.element.querySelector('.head') as HTMLElement;
    const body = this.element.querySelector('.body') as HTMLElement;
    const armLeft = this.element.querySelector('.arm.left') as HTMLElement;
    const armRight = this.element.querySelector('.arm.right') as HTMLElement;

    if (head) this.touchZones.push({ element: head, zone: 'head' });
    if (body) this.touchZones.push({ element: body, zone: 'body' });
    if (armLeft) this.touchZones.push({ element: armLeft, zone: 'arm-left' });
    if (armRight) this.touchZones.push({ element: armRight, zone: 'arm-right' });
  }

  /**
   * Attach mouse and touch event listeners
   */
  private attachEventListeners(): void {
    // Mouse events
    this.element.addEventListener('mousedown', this.handleDragStart);
    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('mouseup', this.handleDragEnd);

    // Touch events
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd);

    // Don't override cursor and position - they're set in CSS
    // Just ensure the element can be dragged
  }

  /**
   * Handle drag start (mouse)
   */
  private handleDragStart = (e: MouseEvent): void => {
    this.dragStartPosition = { x: e.clientX, y: e.clientY };
    this.dragStartTime = Date.now();

    this.dragState.isDragging = true;
    this.dragState.startX = e.clientX - this.dragState.offsetX;
    this.dragState.startY = e.clientY - this.dragState.offsetY;
    this.dragState.lastMoveTime = Date.now();

    // Change cursor to grabbing during drag
    this.element.style.cursor = 'grabbing';

    if (this.onDragStart) {
      this.onDragStart();
    }
  };

  /**
   * Handle touch start
   */
  private handleTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    const touch = e.touches[0];

    this.dragStartPosition = { x: touch.clientX, y: touch.clientY };
    this.dragStartTime = Date.now();

    this.dragState.isDragging = true;
    this.dragState.startX = touch.clientX - this.dragState.offsetX;
    this.dragState.startY = touch.clientY - this.dragState.offsetY;
    this.dragState.lastMoveTime = Date.now();

    if (this.onDragStart) {
      this.onDragStart();
    }
  };

  /**
   * Handle drag move (mouse)
   */
  private handleDragMove = (e: MouseEvent): void => {
    if (!this.dragState.isDragging) return;

    e.preventDefault();

    const now = Date.now();
    const deltaTime = now - this.dragState.lastMoveTime;

    this.dragState.currentX = e.clientX - this.dragState.startX;
    this.dragState.currentY = e.clientY - this.dragState.startY;

    // Calculate velocity (pixels per millisecond)
    const deltaX = this.dragState.currentX - this.dragState.offsetX;
    const deltaY = this.dragState.currentY - this.dragState.offsetY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    this.dragState.velocity = deltaTime > 0 ? distance / deltaTime : 0;

    this.dragState.offsetX = this.dragState.currentX;
    this.dragState.offsetY = this.dragState.currentY;
    this.dragState.lastMoveTime = now;

    this.updatePosition();

    if (this.onDragMove) {
      this.onDragMove(this.dragState.velocity);
    }
  };

  /**
   * Handle touch move
   */
  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.dragState.isDragging) return;

    e.preventDefault();

    const touch = e.touches[0];
    const now = Date.now();
    const deltaTime = now - this.dragState.lastMoveTime;

    this.dragState.currentX = touch.clientX - this.dragState.startX;
    this.dragState.currentY = touch.clientY - this.dragState.startY;

    // Calculate velocity
    const deltaX = this.dragState.currentX - this.dragState.offsetX;
    const deltaY = this.dragState.currentY - this.dragState.offsetY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    this.dragState.velocity = deltaTime > 0 ? distance / deltaTime : 0;

    this.dragState.offsetX = this.dragState.currentX;
    this.dragState.offsetY = this.dragState.currentY;
    this.dragState.lastMoveTime = now;

    this.updatePosition();

    if (this.onDragMove) {
      this.onDragMove(this.dragState.velocity);
    }
  };

  /**
   * Handle drag end (mouse)
   */
  private handleDragEnd = (e: MouseEvent): void => {
    if (!this.dragState.isDragging) return;

    // Check if this was a tap (not a drag)
    const elapsed = Date.now() - this.dragStartTime;
    const distance = Math.sqrt(
      Math.pow(e.clientX - this.dragStartPosition.x, 2) +
      Math.pow(e.clientY - this.dragStartPosition.y, 2)
    );

    // If quick and minimal movement, treat as a tap
    if (elapsed < 300 && distance < 10 && this.onZoneTap) {
      const target = e.target as HTMLElement;
      const zone = this.detectZone(target);
      if (zone) {
        this.onZoneTap(zone);
      }
    }

    this.dragState.isDragging = false;
    this.element.style.cursor = 'grab';

    this.savePosition();

    if (this.onDragEnd) {
      this.onDragEnd();
    }
  };

  /**
   * Handle touch end
   */
  private handleTouchEnd = (e: TouchEvent): void => {
    if (!this.dragState.isDragging) return;

    // Check if this was a tap (not a drag)
    const elapsed = Date.now() - this.dragStartTime;
    const touch = e.changedTouches[0];
    const distance = Math.sqrt(
      Math.pow(touch.clientX - this.dragStartPosition.x, 2) +
      Math.pow(touch.clientY - this.dragStartPosition.y, 2)
    );

    // If quick and minimal movement, treat as a tap
    if (elapsed < 300 && distance < 10 && this.onZoneTap) {
      const target = e.target as HTMLElement;
      const zone = this.detectZone(target);
      if (zone) {
        this.onZoneTap(zone);
      }
    }

    this.dragState.isDragging = false;

    this.savePosition();

    if (this.onDragEnd) {
      this.onDragEnd();
    }
  };

  /**
   * Clamp a value between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Update element position
   * Uses CSS custom properties to work with existing transforms
   * Constrains movement to ±200px on both axes
   */
  private updatePosition(): void {
    // Clamp the drag offsets to the allowed range
    const clampedX = this.clamp(this.dragState.offsetX, -this.MAX_DRAG_X, this.MAX_DRAG_X);
    const clampedY = this.clamp(this.dragState.offsetY, -this.MAX_DRAG_Y, this.MAX_DRAG_Y);

    // Update the drag state with clamped values
    this.dragState.offsetX = clampedX;
    this.dragState.offsetY = clampedY;

    // Apply to CSS custom properties
    this.element.style.setProperty('--drag-x', `${clampedX}px`);
    this.element.style.setProperty('--drag-y', `${clampedY}px`);
  }

  /**
   * Save position to localStorage
   */
  private savePosition(): void {
    const position = {
      x: this.dragState.offsetX,
      y: this.dragState.offsetY
    };
    localStorage.setItem(this.storageKey, JSON.stringify(position));
  }

  /**
   * Load saved position from localStorage
   * Ensures loaded positions are within bounds
   */
  private loadSavedPosition(): void {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const position = JSON.parse(saved);
        // Clamp loaded positions to ensure they're within bounds
        this.dragState.offsetX = this.clamp(position.x || 0, -this.MAX_DRAG_X, this.MAX_DRAG_X);
        this.dragState.offsetY = this.clamp(position.y || 0, -this.MAX_DRAG_Y, this.MAX_DRAG_Y);
        this.updatePosition();
      } catch (e) {
        console.warn('Failed to load saved position:', e);
      }
    }
  }

  /**
   * Detect which zone was interacted with
   */
  private detectZone(target: HTMLElement): string | null {
    for (const zone of this.touchZones) {
      if (zone.element === target || zone.element.contains(target)) {
        return zone.zone;
      }
    }
    return null;
  }

  /**
   * Get current velocity
   */
  getVelocity(): number {
    return this.dragState.velocity;
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this.dragState.isDragging;
  }

  /**
   * Enable or disable dragging
   */
  setEnabled(enabled: boolean): void {
    this.element.style.pointerEvents = enabled ? 'auto' : 'none';
    if (!enabled) {
      this.dragState.isDragging = false;
    }
  }

  /**
   * Reset position to center
   */
  resetPosition(): void {
    this.dragState.offsetX = 0;
    this.dragState.offsetY = 0;
    this.updatePosition();
    this.savePosition();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.element.removeEventListener('mousedown', this.handleDragStart);
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);

    this.element.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
  }
}
