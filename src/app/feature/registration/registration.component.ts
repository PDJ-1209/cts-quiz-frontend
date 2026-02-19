import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  Validators,
  FormGroup,
  FormControl,
  ReactiveFormsModule
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type RegistrationForm = FormGroup<{
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  empId: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
}>;

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegistrationComponent {
  readonly form: RegistrationForm;
  success = false;
  // optional: small UX helpers
  loading = signal(false);
  errorMsg = signal<string | null>(null);
  
  // Fancy popup for validation messages
  popup = signal<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private auth: AuthService // <-- inject AuthService
  ) {
    this.form = this.fb.nonNullable.group(
      {
        firstName: this.fb.nonNullable.control('', [
          Validators.required,
          Validators.maxLength(50)
        ]),
        lastName: this.fb.nonNullable.control('', [
          Validators.required,
          Validators.maxLength(50)
        ]),
        empId: this.fb.nonNullable.control('', [
          Validators.required,
          Validators.maxLength(20),
          Validators.pattern(/^[A-Za-z0-9_-]+$/)
        ]),
        email: this.fb.nonNullable.control('', [
          Validators.required,
          Validators.email
        ]),
        password: this.fb.nonNullable.control('', [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(12)
        ]),
        confirmPassword: this.fb.nonNullable.control('', [
          Validators.required
        ])
      }
    );
  }

  get f() { return this.form.controls; }

 submit(): void {
  this.form.markAllAsTouched();
  this.errorMsg.set(null);
  this.popup.set(null);
  
  // Custom validation: Check password length before form validation
  if (this.f.password.value && this.f.password.value.length < 8) {
    this.showPopup('Invalid password. Password must be at least 8 characters long.', 'error');
    return;
  }
  
  if (this.form.invalid) return;

  const payload = {
    employeeId: this.f.empId.value,
    email: this.f.email.value,
    firstName: this.f.firstName.value,
    lastName: this.f.lastName.value,
    password: this.f.password.value
  };

  this.loading.set(true);
  this.auth.register(payload).subscribe({
    next: () => {
      this.success = true;
      this.showPopup('Registration successful!', 'success');
      setTimeout(() => this.router.navigate(['/login'], { replaceUrl: true }), 1500);
    },
    error: (err: any) => {
      console.error('Registration error:', err);
      const errorText = typeof err?.error === 'string' 
        ? err.error 
        : err?.error?.message || err?.message || 'Registration failed. Please try again.';
      
      // Check for specific error: Employee ID and email already exist
      if (errorText.toLowerCase().includes('employee') && errorText.toLowerCase().includes('email') && errorText.toLowerCase().includes('exist')) {
        this.showPopup('Employee ID and email already exist.', 'error');
      } else {
        this.showPopup(errorText, 'error');
      }
      
      this.errorMsg.set(errorText);
    },
    complete: () => this.loading.set(false)
  });
}

// Method to show fancy popup with auto-hide
private showPopup(message: string, type: 'success' | 'error' | 'warning'): void {
  this.popup.set({ message, type });
  setTimeout(() => this.popup.set(null), 4000);
}

// Method to manually close popup
closePopup(): void {
  this.popup.set(null);
}

goToLogin(): void {
  this.router.navigate(['/login']);
}
}
