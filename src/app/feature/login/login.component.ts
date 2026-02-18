import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, RegisterRequest } from '../../services/auth.service';
import { LoginRequest } from '../../models/auth.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Login fields
  employeeId = signal('');
  password = signal('');
  showPassword = signal(false);
  isLoading = signal(false);
  loginError = signal<string | null>(null);

  // Registration fields
  showRegistration = signal(false);
  regEmployeeId = signal('');
  regEmail = signal('');
  regFirstName = signal('');
  regLastName = signal('');
  regPassword = signal('');
  regConfirmPassword = signal('');
  registrationError = signal<string | null>(null);
  registrationSuccess = signal<string | null>(null);

  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }

  async onLogin() {
    this.isLoading.set(true);
    this.loginError.set(null);

    try {
      const loginRequest: LoginRequest = {
        employeeId: this.employeeId(),
        password: this.password()
      };
      
      const result = await this.authService.login(loginRequest);
      
      if (result.success && result.redirectUrl) {
        this.router.navigate([result.redirectUrl]);
      } else {
        this.loginError.set(result.message || 'Login failed');
      }
    } catch (error) {
      this.loginError.set('An error occurred during login');
      console.error('Login error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRegister() {
    this.isLoading.set(true);
    this.registrationError.set(null);
    this.registrationSuccess.set(null);

    // Validation
    if (this.regPassword() !== this.regConfirmPassword()) {
      this.registrationError.set('Passwords do not match');
      this.isLoading.set(false);
      return;
    }

    try {
      const registerRequest: RegisterRequest = {
        employeeId: this.regEmployeeId(),
        email: this.regEmail(),
        firstName: this.regFirstName(),
        lastName: this.regLastName(),
        password: this.regPassword()
      };
      
      const result = await this.authService.register(registerRequest).toPromise();
      this.registrationSuccess.set('Registration successful! You can now login with your credentials.');
      
      // Reset registration form
      this.regEmployeeId.set('');
      this.regEmail.set('');
      this.regFirstName.set('');
      this.regLastName.set('');
      this.regPassword.set('');
      this.regConfirmPassword.set('');

      // Auto-switch to login view and pre-fill employee ID
      this.showRegistration.set(false);
      this.employeeId.set(registerRequest.employeeId);
      
    } catch (error: any) {
      this.registrationError.set(error.error?.message || 'Registration failed');
      console.error('Registration error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}