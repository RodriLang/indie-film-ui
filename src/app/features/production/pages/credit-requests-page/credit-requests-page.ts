import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClock3,
  LucideLink,
  LucideSend,
  LucideX,
} from '@lucide/angular';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { CreditLinkRequestApi } from '../../data/credit-link-request.api';
import {
  CreditLinkRequestPage,
  CreditLinkRequestStatus,
  ProductionCreditLinkRequest,
} from '../../data/credit-link-request.models';
import { creditRoleLabel } from '../../data/production.models';

type RequestTab = 'received' | 'sent';
type StatusFilter = CreditLinkRequestStatus | null;

@Component({
  selector: 'app-credit-requests-page',
  imports: [
    RouterLink,
    LucideCheck,
    LucideChevronLeft,
    LucideChevronRight,
    LucideClock3,
    LucideLink,
    LucideSend,
    LucideX,
  ],
  templateUrl: './credit-requests-page.html',
  styleUrl: './credit-requests-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditRequestsPage {
  private readonly api = inject(CreditLinkRequestApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly tab = signal<RequestTab>('received');
  readonly status = signal<StatusFilter>('PENDING');
  readonly page = signal<CreditLinkRequestPage | null>(null);
  readonly loading = signal(true);
  readonly busyRequestId = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly filters: readonly { value: StatusFilter; label: string }[] = [
    { value: 'PENDING', label: 'Pendientes' },
    { value: 'ACCEPTED', label: 'Aceptadas' },
    { value: 'REJECTED', label: 'Rechazadas' },
    { value: 'CANCELLED', label: 'Canceladas' },
    { value: null, label: 'Todas' },
  ];

  constructor() {
    this.load();
  }

  selectTab(tab: RequestTab): void {
    if (this.tab() === tab) {
      return;
    }

    this.tab.set(tab);
    this.load(0);
  }

  selectStatus(status: StatusFilter): void {
    if (this.status() === status) {
      return;
    }

    this.status.set(status);
    this.load(0);
  }

  previousPage(): void {
    const page = this.page();
    if (page && !page.first) {
      this.load(page.page - 1);
    }
  }

  nextPage(): void {
    const page = this.page();
    if (page && !page.last) {
      this.load(page.page + 1);
    }
  }

  accept(request: ProductionCreditLinkRequest): void {
    this.resolve(request, 'accept');
  }

  reject(request: ProductionCreditLinkRequest): void {
    this.resolve(request, 'reject');
  }

  cancel(request: ProductionCreditLinkRequest): void {
    this.resolve(request, 'cancel');
  }

  requestTitle(request: ProductionCreditLinkRequest): string {
    if (this.tab() === 'received') {
      return request.type === 'OWNER_INVITATION'
        ? `${request.requestedBy.displayName} quiere vincularte a un crédito`
        : `${request.requestedBy.displayName} reclama una participación`;
    }

    return request.type === 'OWNER_INVITATION'
      ? `Invitaste a ${request.requestedUser.displayName}`
      : 'Reclamaste una participación';
  }

  creditDescription(request: ProductionCreditLinkRequest): string {
    const credit = request.credit ?? request.proposedCredit;
    if (!credit) {
      return '';
    }

    const role = credit.roleDetail || creditRoleLabel(credit.role);
    return `${role} · ${credit.personName}`;
  }

  statusLabel(status: CreditLinkRequestStatus): string {
    return {
      PENDING: 'Pendiente',
      ACCEPTED: 'Aceptada',
      REJECTED: 'Rechazada',
      CANCELLED: 'Cancelada',
    }[status];
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private load(page = 0): void {
    this.loading.set(true);
    this.error.set(null);

    const request =
      this.tab() === 'received'
        ? this.api.findReceived(this.status(), page, 20)
        : this.api.findSent(this.status(), page, 20);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.page.set(result);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(apiErrorMessage(error, 'No pudimos cargar las solicitudes.'));
        this.loading.set(false);
      },
    });
  }

  private resolve(
    request: ProductionCreditLinkRequest,
    action: 'accept' | 'reject' | 'cancel',
  ): void {
    if (this.busyRequestId()) {
      return;
    }

    this.busyRequestId.set(request.id);
    this.error.set(null);
    this.notice.set(null);

    const operation =
      action === 'accept'
        ? this.api.accept(request.id)
        : action === 'reject'
          ? this.api.reject(request.id)
          : this.api.cancel(request.id);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busyRequestId.set(null);
        this.notice.set(
          action === 'accept'
            ? 'Solicitud aceptada.'
            : action === 'reject'
              ? 'Solicitud rechazada.'
              : 'Solicitud cancelada.',
        );
        this.load(this.page()?.page ?? 0);
      },
      error: (error) => {
        this.busyRequestId.set(null);
        this.error.set(apiErrorMessage(error, 'No pudimos actualizar la solicitud.'));
      },
    });
  }
}
