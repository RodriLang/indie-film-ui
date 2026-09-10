import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthApi } from '../../../../core/auth/auth.api';

@Component({
  selector: 'app-verify-email-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './verify-email-page.html',
  styleUrl: '../auth-page/auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApi);
  private readonly route = inject(ActivatedRoute);

  readonly verifying = signal(false);
  readonly verified = signal(false);
  readonly resending = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/explore';

  readonly resendForm = this.fb.nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      return;
    }

    this.verifying.set(true);
    this.error.set(null);

    this.authApi
      .verifyEmail({ token })
      .pipe(finalize(() => this.verifying.set(false)))
      .subscribe({
        next: () => {
          this.verified.set(true);
          this.notice.set('Tu correo quedó verificado. Ya podés iniciar sesión.');
        },
        error: (error) => {
          this.error.set(apiErrorMessage(error, 'No pudimos verificar el correo. El enlace puede haber vencido.'));
        },
      });
  }

  resend(): void {
    if (this.resendForm.invalid || this.resending()) {
      this.resendForm.markAllAsTouched();
      return;
    }

    this.resending.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.authApi
      .resendVerificationEmail(this.resendForm.getRawValue())
      .pipe(finalize(() => this.resending.set(false)))
      .subscribe({
        next: () => {
          this.notice.set('Si la cuenta existe y todavía necesita verificación, enviamos un nuevo correo.');
        },
        error: (error) => {
          this.error.set(apiErrorMessage(error, 'No pudimos reenviar el correo de verificación.'));
        },
      });
  }
}
