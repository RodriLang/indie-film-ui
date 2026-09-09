import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthStore } from '../../../../core/auth/auth.store';
import { MediaRail } from '../../../../shared/ui/media-rail/media-rail';
import { MediaRailItem } from '../../../../shared/ui/media-rail/media-rail-item';
import { ProductionCard } from '../../../production/components/production-card/production-card';
import { ProductionApi } from '../../../production/data/production.api';
import { ProductionSummary } from '../../../production/data/production.models';
import { ViewingProgressApi } from '../../../production/data/viewing-progress.api';
import { ContinueWatching } from '../../../production/data/viewing-progress.models';
import { ContinueWatchingCard } from '../../components/continue-watching-card/continue-watching-card';
import { PrimaryStage } from '../../components/primary-stage/primary-stage';

@Component({
  selector: 'app-explore-page',
  imports: [
    MediaRail,
    MediaRailItem,
    PrimaryStage,
    ProductionCard,
    ContinueWatchingCard,
  ],
  templateUrl: './explore-page.html',
  styleUrl: './explore-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorePage implements OnInit {
  private readonly productionApi = inject(ProductionApi);
  private readonly authStore = inject(AuthStore);
  private readonly viewingProgressApi = inject(ViewingProgressApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly productions = signal<ProductionSummary[]>([]);
  readonly continueWatching = signal<ContinueWatching[]>([]);

  readonly progressActionBusy = signal<number | null>(null);

  ngOnInit(): void {
    this.loadProductions();

    if (this.authStore.authenticated()) {
      this.loadContinueWatching();
    }
  }

  stageProductions(): ProductionSummary[] {
    return this.productions().slice(0, 5);
  }

  featured(): ProductionSummary[] {
    const stageIds = new Set(
      this.stageProductions().map((production) => production.id),
    );

    const fresh = this.productions().filter(
      (production) => !stageIds.has(production.id),
    );

    const stageFallback = this.productions().filter((production) =>
      stageIds.has(production.id),
    );

    return [...fresh, ...stageFallback].slice(0, 8);
  }

  verticalDiscoveries(): ProductionSummary[] {
    const usedIds = new Set([
      ...this.stageProductions().map((production) => production.id),
      ...this.featured().map((production) => production.id),
    ]);

    return this.productions()
      .filter((production) => !usedIds.has(production.id))
      .slice(0, 14);
  }

  selection(): ProductionSummary[] {
    const usedIds = new Set([
      ...this.stageProductions().map((production) => production.id),
      ...this.featured().map((production) => production.id),
      ...this.verticalDiscoveries().map((production) => production.id),
    ]);

    return this.productions()
      .filter((production) => !usedIds.has(production.id))
      .slice(0, 12);
  }

  markAsWatched(item: ContinueWatching): void {
    if (this.progressActionBusy() !== null) {
      return;
    }

    this.progressActionBusy.set(item.productionId);

    this.viewingProgressApi
      .markVideoAsWatched(item.videoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          /*
           * Si es una película, desaparecerá.
           * Si es una serie, puede pasar al siguiente episodio.
           * Por eso recargamos sólo Continuar viendo.
           */
          this.loadContinueWatching();
          this.progressActionBusy.set(null);
        },
        error: () => {
          this.progressActionBusy.set(null);
        },
      });
  }

  deleteViewingActivity(item: ContinueWatching): void {
    if (this.progressActionBusy() !== null) {
      return;
    }

    this.progressActionBusy.set(item.productionId);

    this.viewingProgressApi
      .deleteProductionProgress(item.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.continueWatching.update((items) =>
            items.filter(
              (current) => current.productionId !== item.productionId,
            ),
          );

          this.progressActionBusy.set(null);
        },
        error: () => {
          this.progressActionBusy.set(null);
        },
      });
  }

  private loadProductions(): void {
    this.productionApi
      .findPublished('', null, null, 0, 36)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.productions.set(page.content);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos cargar las producciones.'),
          );

          this.loading.set(false);
        },
      });
  }

  private loadContinueWatching(): void {
    this.viewingProgressApi
      .findContinueWatching(0, 12)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.continueWatching.set(page.content);
        },
        error: () => {
          this.continueWatching.set([]);
        },
      });
  }
}
