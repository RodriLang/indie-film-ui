import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

export interface ImageFocalPoint {
  x: number;
  y: number;
}

@Component({
  selector: 'app-image-focal-editor',
  templateUrl: './image-focal-editor.html',
  styleUrl: './image-focal-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageFocalEditor {
  readonly imageUrl = input.required<string>();
  readonly initialX = input(0.5);
  readonly initialY = input(0.5);

  readonly focalChange = output<ImageFocalPoint>();

  readonly focalX = signal(0.5);
  readonly focalY = signal(0.5);

  private dragging = false;
  private startPointerX = 0;
  private startPointerY = 0;
  private startFocalX = 0.5;
  private startFocalY = 0.5;

  readonly objectPosition = computed(
    () => `${this.focalX() * 100}% ${this.focalY() * 100}%`,
  );

  constructor() {
    effect(() => {
      this.focalX.set(this.initialX());
      this.focalY.set(this.initialY());
    });
  }

  onPointerDown(event: PointerEvent): void {
    const element = event.currentTarget as HTMLElement;

    element.setPointerCapture(event.pointerId);

    this.dragging = true;
    this.startPointerX = event.clientX;
    this.startPointerY = event.clientY;
    this.startFocalX = this.focalX();
    this.startFocalY = this.focalY();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }

    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();

    const deltaX = event.clientX - this.startPointerX;
    const deltaY = event.clientY - this.startPointerY;

    /*
     * Al arrastrar la imagen hacia la derecha queremos mirar
     * más hacia la izquierda, por eso se resta.
     */
    const x = this.clamp(this.startFocalX - deltaX / rect.width);

    const y = this.clamp(this.startFocalY - deltaY / rect.height);

    this.updateFocalPoint(x, y);
  }

  onPointerUp(event: PointerEvent): void {
    const element = event.currentTarget as HTMLElement;

    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }

    this.dragging = false;
  }

  reset(): void {
    this.updateFocalPoint(0.5, 0.5);
  }

  private updateFocalPoint(x: number, y: number): void {
    this.focalX.set(x);
    this.focalY.set(y);

    this.focalChange.emit({ x, y });
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
