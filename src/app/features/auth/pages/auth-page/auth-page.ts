import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../../../../core/api/http-error';
import { AuthApi } from '../../../../core/auth/auth.api';
import { AuthStore } from '../../../../core/auth/auth.store';

function pastDateValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  if (!control.value) {
    return null;
  }

  const selected = new Date(`${control.value}T00:00:00`);

  if (Number.isNaN(selected.getTime())) {
    return { pastDate: true };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selected < today ? null : { pastDate: true };
}

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApi);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly mode = signal<'login' | 'register'>('login');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly today = new Date().toISOString().slice(0, 10);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly registerForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern(/^[A-Za-z0-9._-]+$/),
      ],
    ],
    email: ['', [Validators.required, Validators.email]],
    birthDate: ['', Validators.required],
    password: [
      '',
      [Validators.required, Validators.minLength(8), Validators.maxLength(64)],
    ],
  });

  constructor() {
    if (this.authStore.authenticated()) {
      void this.router.navigateByUrl(this.returnUrl());
      return;
    }

    if (this.route.snapshot.queryParamMap.get('mode') === 'register') {
      this.mode.set('register');
    }
  }

  setMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  submitLogin(): void {
    if (this.loginForm.invalid || this.submitting()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.authApi
      .login(this.loginForm.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          this.authStore.setSession(response);
          void this.router.navigateByUrl(this.returnUrl());
        },
        error: (error) => {
          this.error.set(apiErrorMessage(error, 'No pudimos iniciar sesión.'));
        },
      });
  }

  submitRegister(): void {
    if (this.registerForm.invalid || this.submitting()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.authApi
      .register(this.registerForm.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          this.authStore.setSession(response);
          void this.router.navigateByUrl(this.returnUrl());
        },
        error: (error) => {
          this.error.set(apiErrorMessage(error, 'No pudimos crear la cuenta.'));
        },
      });
  }

  loginFieldError(field: keyof typeof this.loginForm.controls): string | null {
    const control = this.loginForm.controls[field];

    if (!control.touched || control.valid) {
      return null;
    }

    if (field === 'email') {
      if (control.hasError('required')) {
        return 'Ingresá tu email.';
      }

      if (control.hasError('email')) {
        return 'Ingresá un email válido.';
      }
    }

    if (field === 'password' && control.hasError('required')) {
      return 'Ingresá tu contraseña.';
    }

    return 'Revisá este campo.';
  }

  registerFieldError(
    field: keyof typeof this.registerForm.controls,
  ): string | null {
    const control = this.registerForm.controls[field];

    if (!control.touched || control.valid) {
      return null;
    }

    switch (field) {
      case 'displayName':
        if (control.hasError('required')) {
          return 'Ingresá tu nombre.';
        }

        if (control.hasError('maxlength')) {
          return 'El nombre no puede superar los 100 caracteres.';
        }

        break;

      case 'username':
        if (control.hasError('required')) {
          return 'Elegí un nombre de usuario.';
        }

        if (control.hasError('minlength')) {
          return 'Debe tener al menos 3 caracteres.';
        }

        if (control.hasError('maxlength')) {
          return 'No puede superar los 50 caracteres.';
        }

        if (control.hasError('pattern')) {
          return 'Usá sólo letras, números, punto, guion o guion bajo.';
        }

        break;

      case 'email':
        if (control.hasError('required')) {
          return 'Ingresá tu email.';
        }

        if (control.hasError('email')) {
          return 'Ingresá un email válido.';
        }

        break;

      case 'birthDate':
        if (control.hasError('required')) {
          return 'Ingresá tu fecha de nacimiento.';
        }

        if (control.hasError('pastDate')) {
          return 'Ingresá una fecha de nacimiento válida.';
        }

        break;

      case 'password':
        if (control.hasError('required')) {
          return 'Ingresá una contraseña.';
        }

        if (control.hasError('minlength')) {
          return 'Debe tener al menos 8 caracteres.';
        }

        if (control.hasError('maxlength')) {
          return 'No puede superar los 64 caracteres.';
        }

        break;
    }

    return 'Revisá este campo.';
  }

  private returnUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') || '/explore';
  }
}
