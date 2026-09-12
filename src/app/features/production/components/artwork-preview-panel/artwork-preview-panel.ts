import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

import { ProductionVideoPlayback } from '../../data/production.models';
import { AutoplayTrailerPlayer } from '../../../discovery/components/autoplay-trailer-player/autoplay-trailer-player';

@Component({
  selector: 'app-artwork-preview-panel',
  imports: [AutoplayTrailerPlayer],
  templateUrl: './artwork-preview-panel.html',
  styleUrl: './artwork-preview-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtworkPreviewPanel {
  readonly editable = input(false);

  readonly title = input('');

  readonly posterUrl = input('');
  readonly posterFocalX = input(0.5);
  readonly posterFocalY = input(0.5);

  readonly titleArtUrl = input('');
  readonly titleArtX = input(0.5);
  readonly titleArtY = input(0.75);
  readonly titleArtScale = input(1);

  readonly hasTrailer = input(false);
  readonly trailerThumbnailUrl = input('');
  readonly trailerPlayback = input<ProductionVideoPlayback | null>(null);
  readonly trailerLoading = input(false);
  readonly trailerFailed = input(false);

  readonly focalXChange = output<number>();
  readonly focalYChange = output<number>();

  readonly titleArtXChange = output<number>();
  readonly titleArtYChange = output<number>();
  readonly titleArtScaleChange = output<number>();

  readonly trailerPlayerUnavailable = output<void>();

  readonly titleArtDragging = signal(false);

  private draggingFocalPoint = false;

  private titleArtStartPointerX = 0;
  private titleArtStartPointerY = 0;
  private titleArtStartX = 0.5;
  private titleArtStartY = 0.75;

  poster(): string {
    return this.posterUrl().trim();
  }

  titleArt(): string {
    return this.titleArtUrl().trim();
  }

  displayTitle(): string {
    return this.title().trim() || 'Título de la producción';
  }

  normalizedFocalX(): number {
    return this.normalizePosition(this.posterFocalX(), 0.5);
  }

  normalizedFocalY(): number {
    return this.normalizePosition(this.posterFocalY(), 0.5);
  }

  focalXPercent(): number {
    return Math.round(this.normalizedFocalX() * 100);
  }

  focalYPercent(): number {
    return Math.round(this.normalizedFocalY() * 100);
  }

  posterObjectPosition(): string {
    return `${this.focalXPercent()}% ${this.focalYPercent()}%`;
  }

  normalizedTitleArtX(): number {
    return this.normalizePosition(this.titleArtX(), 0.5);
  }

  normalizedTitleArtY(): number {
    return this.normalizePosition(this.titleArtY(), 0.75);
  }

  normalizedTitleArtScale(): number {
    const value = this.titleArtScale();

    if (!Number.isFinite(value)) {
      return 1;
    }

    return Math.min(2.5, Math.max(0.5, value));
  }

  titleArtXPercent(): number {
    return Math.round(this.normalizedTitleArtX() * 100);
  }

  titleArtYPercent(): number {
    return Math.round(this.normalizedTitleArtY() * 100);
  }

  titleArtScalePercent(): number {
    return Math.round(this.normalizedTitleArtScale() * 100);
  }

  isTitleArtHorizontallyCentered(): boolean {
    return Math.abs(this.normalizedTitleArtX() - 0.5) <= 0.01;
  }

  stageFallbackUrl(): string {
    const thumbnail = this.trailerThumbnailUrl().trim();

    if (this.hasTrailer() && thumbnail) {
      return thumbnail;
    }

    return this.poster();
  }

  changeFocalX(event: Event): void {
    if (!this.editable()) {
      return;
    }

    const input = event.target as HTMLInputElement;

    this.focalXChange.emit(this.normalizePosition(Number(input.value), 0.5));
  }

  changeFocalY(event: Event): void {
    if (!this.editable()) {
      return;
    }

    const input = event.target as HTMLInputElement;

    this.focalYChange.emit(this.normalizePosition(Number(input.value), 0.5));
  }

  startFocalEdit(event: PointerEvent, element: HTMLElement): void {
    if (!this.editable() || !this.poster()) {
      return;
    }

    event.preventDefault();

    this.draggingFocalPoint = true;

    if (!element.hasPointerCapture(event.pointerId)) {
      element.setPointerCapture(event.pointerId);
    }

    this.updateFocalPoint(event, element);
  }

  moveFocalEdit(event: PointerEvent, element: HTMLElement): void {
    if (!this.draggingFocalPoint || !this.editable()) {
      return;
    }

    event.preventDefault();

    this.updateFocalPoint(event, element);
  }

  stopFocalEdit(event: PointerEvent): void {
    if (!this.draggingFocalPoint) {
      return;
    }

    this.draggingFocalPoint = false;

    const element = event.currentTarget as HTMLElement;

    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
  }

  cancelFocalEdit(): void {
    this.draggingFocalPoint = false;
  }

  startTitleArtEdit(event: PointerEvent, stage: HTMLElement): void {
    if (!this.editable() || !this.titleArt()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.titleArtDragging.set(true);

    this.titleArtStartPointerX = event.clientX;
    this.titleArtStartPointerY = event.clientY;

    this.titleArtStartX = this.normalizedTitleArtX();
    this.titleArtStartY = this.normalizedTitleArtY();

    const element = event.currentTarget as HTMLElement;

    if (!element.hasPointerCapture(event.pointerId)) {
      element.setPointerCapture(event.pointerId);
    }
  }

  moveTitleArtEdit(event: PointerEvent, stage: HTMLElement): void {
    if (!this.titleArtDragging() || !this.editable()) {
      return;
    }

    event.preventDefault();

    const rect = stage.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const deltaX = (event.clientX - this.titleArtStartPointerX) / rect.width;

    const deltaY = (event.clientY - this.titleArtStartPointerY) / rect.height;

    let x = this.normalizePosition(this.titleArtStartX + deltaX, 0.5);

    if (Math.abs(x - 0.5) <= 0.015) {
      x = 0.5;
    }

    this.titleArtXChange.emit(x);

    this.titleArtYChange.emit(
      this.normalizePosition(this.titleArtStartY + deltaY, 0.75),
    );
  }

  stopTitleArtEdit(event: PointerEvent): void {
    if (!this.titleArtDragging()) {
      return;
    }

    this.titleArtDragging.set(false);

    const element = event.currentTarget as HTMLElement;

    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
  }

  cancelTitleArtEdit(): void {
    this.titleArtDragging.set(false);
  }

  changeTitleArtScale(event: Event): void {
    if (!this.editable()) {
      return;
    }

    const input = event.target as HTMLInputElement;

    this.titleArtScaleChange.emit(
      this.normalizeTitleArtScale(Number(input.value)),
    );
  }

  resetTitleArtLayout(): void {
    if (!this.editable()) {
      return;
    }

    this.titleArtXChange.emit(0.5);
    this.titleArtYChange.emit(0.75);
    this.titleArtScaleChange.emit(1);
  }

  private normalizeTitleArtScale(value: number): number {
    if (!Number.isFinite(value)) {
      return 1;
    }

    return Math.min(2.5, Math.max(0.5, value));
  }

  private updateFocalPoint(event: PointerEvent, element: HTMLElement): void {
    const rect = element.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = this.normalizePosition(
      (event.clientX - rect.left) / rect.width,
      0.5,
    );

    const y = this.normalizePosition(
      (event.clientY - rect.top) / rect.height,
      0.5,
    );

    this.focalXChange.emit(x);
    this.focalYChange.emit(y);
  }

  private normalizePosition(value: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(1, Math.max(0, value));
  }
}
