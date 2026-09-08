import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';

export type MediaRailVariant = 'featured' | 'vertical' | 'compact' | 'medium';

@Component({
  selector: 'app-media-rail',
  templateUrl: './media-rail.html',
  styleUrl: './media-rail.scss',
  host: {
    '[class]': '"media-rail-host media-rail-host--" + variant()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MediaRail {
  readonly variant = input<MediaRailVariant>('vertical');
  readonly ariaLabel = input('Contenido desplazable');

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private snapTimer: ReturnType<typeof setTimeout> | undefined;

  onScroll(): void {
    if (!this.usesStrictSnap()) {
      return;
    }

    clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => this.snapToNearest(), 90);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    this.moveBy(event.key === 'ArrowRight' ? 1 : -1);
  }

  private usesStrictSnap(): boolean {
    return this.variant() === 'featured' || this.variant() === 'medium';
  }

  private moveBy(offset: number): void {
    const viewport = this.viewport().nativeElement;
    const targets = this.getSnapTargets(viewport);

    if (targets.length === 0) {
      return;
    }

    const currentIndex = this.findNearestIndex(viewport.scrollLeft, targets);
    const targetIndex = Math.max(0, Math.min(currentIndex + offset, targets.length - 1));
    viewport.scrollTo({ left: targets[targetIndex], behavior: 'smooth' });
  }

  private snapToNearest(): void {
    const viewport = this.viewport().nativeElement;
    const targets = this.getSnapTargets(viewport);

    if (targets.length === 0) {
      return;
    }

    const target = targets[this.findNearestIndex(viewport.scrollLeft, targets)];

    if (Math.abs(viewport.scrollLeft - target) < 2) {
      return;
    }

    viewport.scrollTo({ left: target, behavior: 'smooth' });
  }

  private getSnapTargets(viewport: HTMLElement): number[] {
    const items = Array.from(viewport.children) as HTMLElement[];

    if (items.length === 0) {
      return [];
    }

    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

    return items.map((item, index) => {
      if (index === items.length - 1) {
        return maxScroll;
      }

      return Math.min(item.offsetLeft, maxScroll);
    });
  }

  private findNearestIndex(position: number, targets: number[]): number {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    targets.forEach((target, index) => {
      const distance = Math.abs(position - target);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }
}
