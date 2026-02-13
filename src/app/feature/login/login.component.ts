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

  // Fancy popup for validation messages
  popup = signal<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

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
    this.popup.set(null);

    try {
      const loginRequest: LoginRequest = {
        employeeId: this.employeeId(),
        password: this.password()
      };
      
      const result = await this.authService.login(loginRequest);
      
      if (result.success && result.redirectUrl) {
        this.showPopup('Login successful!', 'success');
        setTimeout(() => this.router.navigate([result.redirectUrl]), 500);
      } else {
        // Parse specific error messages and show appropriate popup
        const errorMessage = result.message || 'Login failed';
        
        if (errorMessage.toLowerCase().includes('incorrect password')) {
          this.showPopup('Incorrect password.', 'error');
        } else if (errorMessage.toLowerCase().includes('employee id') && errorMessage.toLowerCase().includes('not exist')) {
          this.showPopup('Employee ID does not exist.', 'error');
        } else if (errorMessage.toLowerCase().includes('user') && errorMessage.toLowerCase().includes('not exist')) {
          this.showPopup('User does not exist.', 'error');
        } else {
          this.showPopup(errorMessage, 'error');
        }
        
        this.loginError.set(result.message || 'Login failed');
      }
    } catch (error) {
      this.showPopup('An error occurred during login', 'error');
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
    this.popup.set(null);

    // Validation: Check password length
    if (this.regPassword().length < 8) {
      this.showPopup('Invalid password. Password must be at least 8 characters long.', 'error');
      this.registrationError.set('Invalid password. Password must be at least 8 characters long.');
      this.isLoading.set(false);
      return;
    }

    // Validation: Check if passwords match
    if (this.regPassword() !== this.regConfirmPassword()) {
      this.showPopup('Passwords do not match', 'error');
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
      
      const result = await this.authService.register(registerRequest);
      this.showPopup('Registration successful!', 'success');
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
      const errorText = error.error?.message || 'Registration failed';
      
      // Check for specific error: Employee ID and email already exist
      if (errorText.toLowerCase().includes('employee') && errorText.toLowerCase().includes('email') && errorText.toLowerCase().includes('exist')) {
        this.showPopup('Employee ID and email already exist.', 'error');
        this.registrationError.set('Employee ID and email already exist.');
      } else {
        this.showPopup(errorText, 'error');
        this.registrationError.set(errorText);
      }
      
      console.error('Registration error:', error);
    } finally {
      this.isLoading.set(false);
    }
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
}