import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideSearch, LucideX } from '@lucide/angular';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { ProductionCard } from '../../../production/components/production-card/production-card';
import { ProductionApi } from '../../../production/data/production.api';
import { PRODUCTION_TYPE_OPTIONS, ProductionSummary, ProductionType } from '../../../production/data/production.models';

@Component({
  selector: 'app-search-page',
  imports: [ProductionCard, LucideSearch, LucideX],
  templateUrl: './search-page.html',
  styleUrl: './search-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchPage implements OnInit {
  private readonly productionApi = inject(ProductionApi);
  private readonly destroyRef = inject(DestroyRef);
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  readonly typeOptions = PRODUCTION_TYPE_OPTIONS;
  readonly query = signal('');
  readonly selectedType = signal<ProductionType | null>(null);
  readonly productions = signal<ProductionSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(0);
  readonly last = signal(true);

  ngOnInit(): void {
    this.search(true);
  }

  onQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.search(true), 260);
  }

  clearQuery(input: HTMLInputElement): void {
    input.value = '';
    this.query.set('');
    this.search(true);
    input.focus();
  }

  selectType(type: ProductionType | null): void {
    if (this.selectedType() === type) {
      return;
    }

    this.selectedType.set(type);
    this.search(true);
  }

  loadMore(): void {
    if (this.loading() || this.last()) {
      return;
    }

    this.search(false);
  }

  private search(reset: boolean): void {
    const targetPage = reset ? 0 : this.page() + 1;
    this.loading.set(true);
    this.error.set(null);

    this.productionApi.findPublished(
      this.query().trim(),
      this.selectedType(),
      null,
      targetPage,
      24
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.productions.set(reset ? result.content : [...this.productions(), ...result.content]);
          this.page.set(result.page);
          this.last.set(result.last);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiErrorMessage(error, 'No pudimos completar la búsqueda.'));
          this.loading.set(false);
        }
      });
  }
}
