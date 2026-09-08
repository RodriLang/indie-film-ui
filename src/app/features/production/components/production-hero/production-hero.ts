import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideLayers3, LucidePlay } from '@lucide/angular';

import { Production, productionTypeLabel } from '../../data/production.models';

@Component({
  selector: 'app-production-hero',
  imports: [RouterLink, LucideArrowRight, LucideLayers3, LucidePlay],
  templateUrl: './production-hero.html',
  styleUrl: './production-hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductionHero {
  readonly production = input.required<Production>();
  readonly posterFailed = signal(false);
  readonly landscapeFailed = signal(false);
  readonly titleArtFailed = signal(false);
  readonly typeLabel = computed(() => productionTypeLabel(this.production().type));
}
