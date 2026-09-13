import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorCode, apiErrorMessage } from '../../../../core/api/http-error';
import { AuthApi } from '../../../../core/auth/auth.api';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import {
  GoogleAuthStatus,
  GoogleProfile,
  RegistrationRole,
} from '../../../../core/auth/auth.models';
import { CreatorSpecialty } from '../../../user/data/creator.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { GoogleSignInButton } from '../../../../shared/ui/google-sign-in-button/google-sign-in-button';

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

function passwordsMatchValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password === confirmPassword ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-auth-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideEye,
    LucideEyeOff,
    GoogleSignInButton,
  ],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApi);
  private readonly authSession = inject(AuthSessionService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<'login' | 'register'>('login');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly loginPasswordVisible = signal(false);
  readonly registerPasswordVisible = signal(false);

  readonly googleStatus = signal<GoogleAuthStatus | null>(null);
  readonly googleCredential = signal<string | null>(null);
  readonly googleProfile = signal<GoogleProfile | null>(null);
  readonly googleLinkPasswordVisible = signal(false);

  readonly googleLinkForm = this.fb.nonNullable.group({
    password: [
      '',
      [Validators.required, Validators.minLength(8), Validators.maxLength(64)],
    ],
  });

  readonly today = new Date().toISOString().slice(0, 10);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly registerForm = this.fb.nonNullable.group(
    {
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

      birthDate: ['', [Validators.required, pastDateValidator]],

      role: this.fb.nonNullable.control<RegistrationRole>('USER'),

      bio: ['', Validators.maxLength(2000)],

      specialties: this.fb.nonNullable.control<CreatorSpecialty[]>([]),

      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(64),
        ],
      ],

      confirmPassword: ['', Validators.required],
    },
    {
      validators: passwordsMatchValidator,
    },
  );

  constructor() {
    this.registerForm.controls.birthDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((birthDate) => {
        if (
          this.registerForm.controls.role.value === 'CREATOR' &&
          !this.isAdultBirthDate(birthDate)
        ) {
          this.setRegistrationRole('USER');
        }
      });

    if (this.authStore.authenticated()) {
      void this.router.navigateByUrl(this.returnUrl());
      return;
    }

    if (this.route.snapshot.queryParamMap.get('mode') === 'register') {
      this.mode.set('register');
    }
  }

  setMode(mode: 'login' | 'register'): void {
    if (mode !== this.mode()) {
      this.cancelGoogleFlow();
    }

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

    this.authSession
      .login(this.loginForm.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(this.returnUrl());
        },
        error: (error) => {
          if (apiErrorCode(error) === 'EMAIL_NOT_VERIFIED') {
            void this.router.navigate(['/verify-email'], {
              queryParams: {
                email: this.loginForm.controls.email.value,
                returnUrl: this.returnUrl(),
              },
            });
            return;
          }

          this.error.set(apiErrorMessage(error, 'No pudimos iniciar sesión.'));
        },
      });
  }

  submitRegister(): void {
    if (this.registerForm.invalid || this.submitting()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    if (this.googleStatus() === 'REGISTRATION_REQUIRED') {
      this.submitGoogleRegistration();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const { confirmPassword, ...request } = this.registerForm.getRawValue();

    this.authApi
      .register(request)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          void this.router.navigate(['/verify-email'], {
            queryParams: {
              email: response.email,
              returnUrl: this.returnUrl(),
            },
          });
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

  continueWithGoogle(credential: string): void {
    if (this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.authSession
      .continueWithGoogle(credential)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          switch (response.status) {
            case 'AUTHENTICATED':
              void this.router.navigateByUrl(this.returnUrl());
              return;

            case 'REGISTRATION_REQUIRED':
              if (!response.profile) {
                this.error.set('Google no devolvió los datos necesarios.');
                return;
              }

              this.beginGoogleRegistration(credential, response.profile);
              return;

            case 'LINK_CONFIRMATION_REQUIRED':
              if (!response.profile) {
                this.error.set('No pudimos identificar la cuenta de Google.');
                return;
              }

              this.beginGoogleLink(credential, response.profile);
              return;
          }
        },

        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos continuar con Google.'),
          );
        },
      });
  }

  cancelGoogleFlow(): void {
    this.googleStatus.set(null);
    this.googleCredential.set(null);
    this.googleProfile.set(null);
    this.googleLinkForm.reset();

    this.setGoogleRegistrationValidators(false);

    this.registerForm.patchValue({
      email: '',
      password: '',
      confirmPassword: '',
    });

    this.error.set(null);
  }

  submitGoogleLink(): void {
    if (this.googleLinkForm.invalid || this.submitting()) {
      this.googleLinkForm.markAllAsTouched();
      return;
    }

    const credential = this.googleCredential();

    if (!credential) {
      this.error.set('La sesión de Google ya no está disponible.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.authSession
      .linkGoogle({
        credential,
        password: this.googleLinkForm.controls.password.value,
      })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(this.returnUrl());
        },

        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'No pudimos vincular tu cuenta con Google.'),
          );
        },
      });
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

      case 'bio':
        if (control.hasError('maxlength')) {
          return 'La descripción no puede superar los 2000 caracteres.';
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

  setRegistrationRole(role: RegistrationRole): void {
    if (role === 'CREATOR' && !this.canRegisterAsCreator()) {
      return;
    }

    const roleControl = this.registerForm.controls.role;

    roleControl.setValue(role);
    roleControl.markAsDirty();

    if (role === 'USER') {
      this.registerForm.controls.specialties.setValue([]);
    }
  }

  hasSpecialty(specialty: CreatorSpecialty): boolean {
    return this.registerForm.controls.specialties.value.includes(specialty);
  }

  toggleSpecialty(specialty: CreatorSpecialty): void {
    const control = this.registerForm.controls.specialties;
    const current = control.value;

    control.setValue(
      current.includes(specialty)
        ? current.filter((value) => value !== specialty)
        : [...current, specialty],
    );

    control.markAsDirty();
  }

  readonly creatorSpecialtyOptions: ReadonlyArray<{
    value: CreatorSpecialty;
    label: string;
  }> = [
    { value: 'DIRECTING', label: 'Dirección' },
    { value: 'SCREENWRITING', label: 'Guion' },
    { value: 'PRODUCING', label: 'Producción' },
    { value: 'CINEMATOGRAPHY', label: 'Dirección de fotografía' },
    { value: 'CAMERA', label: 'Cámara' },
    { value: 'EDITING', label: 'Montaje' },
    { value: 'COLOR', label: 'Color' },
    { value: 'SOUND', label: 'Sonido' },
    { value: 'MUSIC', label: 'Música' },
    { value: 'ART_DIRECTION', label: 'Dirección de arte' },
    { value: 'PRODUCTION_DESIGN', label: 'Diseño de producción' },
    { value: 'VFX', label: 'Efectos visuales' },
    { value: 'ANIMATION', label: 'Animación' },
    { value: 'ACTING', label: 'Actuación' },
  ];

  isAdultBirthDate(birthDate: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);

    if (!match) {
      return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const today = new Date();

    const minimumBirthDate =
      (today.getFullYear() - 18) * 10000 +
      (today.getMonth() + 1) * 100 +
      today.getDate();

    const selectedBirthDate = year * 10000 + month * 100 + day;

    return selectedBirthDate <= minimumBirthDate;
  }

  canRegisterAsCreator(): boolean {
    return this.isAdultBirthDate(this.registerForm.controls.birthDate.value);
  }

  private returnUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') || '/explore';
  }

  private beginGoogleRegistration(
    credential: string,
    profile: GoogleProfile,
  ): void {
    this.googleCredential.set(credential);
    this.googleProfile.set(profile);
    this.googleStatus.set('REGISTRATION_REQUIRED');

    this.mode.set('register');

    this.registerForm.patchValue({
      displayName: profile.displayName ?? '',
      email: profile.email,
    });

    this.setGoogleRegistrationValidators(true);
  }

  private beginGoogleLink(credential: string, profile: GoogleProfile): void {
    this.googleCredential.set(credential);
    this.googleProfile.set(profile);
    this.googleStatus.set('LINK_CONFIRMATION_REQUIRED');

    this.mode.set('login');
    this.googleLinkForm.reset();
  }

  private setGoogleRegistrationValidators(enabled: boolean): void {
    const email = this.registerForm.controls.email;
    const password = this.registerForm.controls.password;
    const confirmPassword = this.registerForm.controls.confirmPassword;

    if (enabled) {
      email.clearValidators();
      password.clearValidators();
      confirmPassword.clearValidators();
    } else {
      email.setValidators([Validators.required, Validators.email]);

      password.setValidators([
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(64),
      ]);

      confirmPassword.setValidators(Validators.required);
    }

    email.updateValueAndValidity({ emitEvent: false });
    password.updateValueAndValidity({ emitEvent: false });
    confirmPassword.updateValueAndValidity({ emitEvent: false });
  }

  private submitGoogleRegistration(): void {
    const credential = this.googleCredential();

    if (!credential) {
      this.error.set('La sesión de Google ya no está disponible.');
      return;
    }

    const value = this.registerForm.getRawValue();

    this.submitting.set(true);
    this.error.set(null);

    this.authSession
      .registerWithGoogle({
        credential,
        username: value.username.trim(),
        displayName: value.displayName.trim(),
        birthDate: value.birthDate,
        role: value.role,
        bio: value.role === 'CREATOR' ? value.bio.trim() || null : null,
        specialties: value.role === 'CREATOR' ? value.specialties : [],
      })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(this.returnUrl());
        },

        error: (error) => {
          this.error.set(
            apiErrorMessage(
              error,
              'No pudimos completar el registro con Google.',
            ),
          );
        },
      });
  }
}
