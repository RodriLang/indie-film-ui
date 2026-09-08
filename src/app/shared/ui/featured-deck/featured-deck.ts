import { ChangeDetectionStrategy, Component, ElementRef, input, signal, viewChild } from '@angular/core';

import { ProductionSummary } from '../../../features/production/data/production.models';
import { ProductionCard } from '../../../features/production/components/production-card/production-card';

@Component({
  selector: 'app-featured-deck',
  imports: [ProductionCard],
  templateUrl: './featured-deck.html',
  styleUrl: './featured-deck.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeaturedDeck {
  readonly productions = input.required<ProductionSummary[]>();
  readonly ariaLabel = input('Producciones destacadas');
  readonly activeIndex = signal(0);

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private scrollTimer: ReturnType<typeof setTimeout> | undefined;

  onScroll(): void {
    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => this.snap(), 80);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }

    event.preventDefault();
    this.goTo(this.activeIndex() + (event.key === 'ArrowRight' ? 1 : -1));
  }

  goTo(index: number): void {
    const viewport = this.viewport().nativeElement;
    const targets = this.getSnapTargets(viewport);

    if (targets.length === 0) {
      return;
    }

    const next = Math.max(0, Math.min(index, targets.length - 1));
    this.activeIndex.set(next);
    viewport.scrollTo({ left: targets[next], behavior: 'smooth' });
  }

  private snap(): void {
    const viewport = this.viewport().nativeElement;
    const targets = this.getSnapTargets(viewport);

    if (targets.length === 0) {
      return;
    }

    const nearest = this.findNearestIndex(viewport.scrollLeft, targets);
    this.activeIndex.set(nearest);

    if (Math.abs(viewport.scrollLeft - targets[nearest]) > 2) {
      viewport.scrollTo({ left: targets[nearest], behavior: 'smooth' });
    }
  }

  private getSnapTargets(viewport: HTMLElement): number[] {
    const items = Array.from(viewport.children) as HTMLElement[];
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

    return items.map((item, index) => index === items.length - 1
      ? maxScroll
      : Math.min(item.offsetLeft, maxScroll));
  }

  private findNearestIndex(position: number, targets: number[]): number {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    targets.forEach((target, index) => {
      const distance = Math.abs(position - target);

      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });

    return nearestIndex;
  }
}
