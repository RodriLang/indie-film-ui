import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideLayers3 } from '@lucide/angular';

import { ProductionCardModel, ProductionCardVariant } from './production-card.model';

@Component({
  selector: 'app-production-card',
  imports: [RouterLink, LucideLayers3],
  templateUrl: './production-card.html',
  styleUrl: './production-card.scss',
  host: {
    '[class]': '"production-card-host production-card-host--" + variant()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductionCard {
  readonly production = input.required<ProductionCardModel>();
  readonly variant = input<ProductionCardVariant>('compact');
  readonly priority = input(false);

  readonly imageFailed = signal(false);
  readonly tone = computed(() => {
    const slug = this.production().slug;
    let hash = 0;

    for (const char of slug) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }

    return hash % 8;
  });

  onImageError(): void {
    this.imageFailed.set(true);
  }
}
