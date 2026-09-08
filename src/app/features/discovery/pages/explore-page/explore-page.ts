import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { MediaRail } from '../../../../shared/ui/media-rail/media-rail';
import { MediaRailItem } from '../../../../shared/ui/media-rail/media-rail-item';
import { ProductionCard } from '../../../production/components/production-card/production-card';
import { ProductionSummary } from '../../../production/data/production.models';
import { ProductionApi } from '../../../production/data/production.api';
import { PrimaryStage } from '../../components/primary-stage/primary-stage';

@Component({
  selector: 'app-explore-page',
  imports: [MediaRail, MediaRailItem, PrimaryStage, ProductionCard],
  templateUrl: './explore-page.html',
  styleUrl: './explore-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExplorePage implements OnInit {
  private readonly productionApi = inject(ProductionApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly productions = signal<ProductionSummary[]>([]);

  ngOnInit(): void {
    this.productionApi.findPublished('', null, null, 0, 36)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.productions.set(page.content);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiErrorMessage(error, 'No pudimos cargar las producciones.'));
          this.loading.set(false);
        }
      });
  }

  stageProductions(): ProductionSummary[] {
    return this.productions().slice(0, 5);
  }

  featured(): ProductionSummary[] {
    const stageIds = new Set(this.stageProductions().map((production) => production.id));
    const fresh = this.productions().filter((production) => !stageIds.has(production.id));
    const stageFallback = this.productions().filter((production) => stageIds.has(production.id));

    return [...fresh, ...stageFallback].slice(0, 8);
  }

  verticalDiscoveries(): ProductionSummary[] {
    const usedIds = new Set([
      ...this.stageProductions().map((production) => production.id),
      ...this.featured().map((production) => production.id)
    ]);

    return this.productions()
      .filter((production) => !usedIds.has(production.id))
      .slice(0, 14);
  }

  selection(): ProductionSummary[] {
    const usedIds = new Set([
      ...this.stageProductions().map((production) => production.id),
      ...this.featured().map((production) => production.id),
      ...this.verticalDiscoveries().map((production) => production.id)
    ]);

    return this.productions().filter((production) => !usedIds.has(production.id)).slice(0, 12);
  }
}
