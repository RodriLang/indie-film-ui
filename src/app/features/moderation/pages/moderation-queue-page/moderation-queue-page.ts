import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideChevronRight, LucideShieldCheck } from '@lucide/angular';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { productionTypeLabel, ProductionModerationStatus } from '../../../production/data/production.models';
import { ProductionModerationApi } from '../../data/production-moderation.api';
import { ModerationProductionSummary } from '../../data/production-moderation.models';

type ModerationTab = Exclude<ProductionModerationStatus, 'NOT_SUBMITTED'>;

@Component({
  selector: 'app-moderation-queue-page',
  imports: [RouterLink, LucideChevronRight, LucideShieldCheck],
  templateUrl: './moderation-queue-page.html',
  styleUrl: './moderation-queue-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModerationQueuePage implements OnInit {
  private readonly moderationApi = inject(ProductionModerationApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly productions = signal<ModerationProductionSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly activeStatus = signal<ModerationTab>('PENDING');

  readonly tabs: readonly { value: ModerationTab; label: string }[] = [
    { value: 'PENDING', label: 'Pendientes' },
    { value: 'APPROVED', label: 'Aprobadas' },
    { value: 'REJECTED', label: 'Rechazadas' }
  ];

  ngOnInit(): void {
    const status = this.route.snapshot.queryParamMap.get('status');
    const initial = status === 'APPROVED' || status === 'REJECTED' ? status : 'PENDING';
    this.activeStatus.set(initial);
    this.load(initial);
  }

  selectStatus(status: ModerationTab): void {
    if (status === this.activeStatus() && !this.error()) {
      return;
    }

    this.activeStatus.set(status);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: status === 'PENDING' ? null : status },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.load(status);
  }

  typeLabel(production: ModerationProductionSummary): string {
    return productionTypeLabel(production.type);
  }

  structureLabel(production: ModerationProductionSummary): string {
    return production.structure === 'EPISODIC' ? 'Serie' : 'Una pieza';
  }

  dateLabel(value?: string | null): string {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  emptyLabel(): string {
    return ({
      PENDING: 'No hay obras pendientes',
      APPROVED: 'Todavía no hay obras aprobadas',
      REJECTED: 'Todavía no hay obras rechazadas'
    })[this.activeStatus()];
  }

  private load(status: ModerationTab): void {
    this.loading.set(true);
    this.error.set(null);

    this.moderationApi.findAll(status, 0, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.productions.set(page.content);
          this.total.set(page.totalElements);
          this.loading.set(false);
        },
        error: (error) => {
          this.productions.set([]);
          this.total.set(0);
          this.error.set(apiErrorMessage(error, 'No pudimos cargar la moderación.'));
          this.loading.set(false);
        }
      });
  }
}
