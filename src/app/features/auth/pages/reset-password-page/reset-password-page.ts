import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthApi } from '../../../../core/auth/auth.api';

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password-page.html',
  styleUrl: '../auth-page/auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApi);
  private readonly route = inject(ActivatedRoute);

  readonly token = this.route.snapshot.queryParamMap.get('token');
  readonly submitting = signal(false);
  readonly completed = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(64)]],
    confirmPassword: ['', [Validators.required]],
  });

  submit(): void {
    if (!this.token) {
      this.error.set('El enlace de recuperación no contiene un token válido.');
      return;
    }

    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    if (value.newPassword !== value.confirmPassword) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.authApi
      .resetPassword({ token: this.token, newPassword: value.newPassword })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.completed.set(true),
        error: (error) => {
          this.error.set(apiErrorMessage(error, 'No pudimos restablecer la contraseña. El enlace puede haber vencido.'));
        },
      });
  }
}
