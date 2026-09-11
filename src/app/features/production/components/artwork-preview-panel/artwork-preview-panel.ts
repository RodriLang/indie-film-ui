import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

import {
  ProductionVideoPlayback,
  TitleArtPosition,
} from '../../data/production.models';
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
  readonly titleArtPosition = input<TitleArtPosition>('BOTTOM');

  readonly hasTrailer = input(false);
  readonly trailerThumbnailUrl = input('');
  readonly trailerPlayback = input<ProductionVideoPlayback | null>(null);
  readonly trailerLoading = input(false);
  readonly trailerFailed = input(false);

  readonly focalXChange = output<number>();
  readonly focalYChange = output<number>();
  readonly trailerPlayerUnavailable = output<void>();

  private draggingFocalPoint = false;

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
    return this.normalizeFocal(this.posterFocalX());
  }

  normalizedFocalY(): number {
    return this.normalizeFocal(this.posterFocalY());
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

    this.focalXChange.emit(this.normalizeFocal(Number(input.value)));
  }

  changeFocalY(event: Event): void {
    if (!this.editable()) {
      return;
    }

    const input = event.target as HTMLInputElement;

    this.focalYChange.emit(this.normalizeFocal(Number(input.value)));
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

  private updateFocalPoint(event: PointerEvent, element: HTMLElement): void {
    const rect = element.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = this.normalizeFocal((event.clientX - rect.left) / rect.width);

    const y = this.normalizeFocal((event.clientY - rect.top) / rect.height);

    this.focalXChange.emit(x);
    this.focalYChange.emit(y);
  }

  private normalizeFocal(value: number): number {
    if (!Number.isFinite(value)) {
      return 0.5;
    }

    return Math.min(1, Math.max(0, value));
  }
}
