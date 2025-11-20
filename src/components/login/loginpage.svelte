<script>

  // Material Web Components removed - using custom components with Material Design styling
  import './loginpage.css';
  import { onMount } from 'svelte';
  import { validateIdNumber, validatePassword } from './js/validation.js';
  import { getCurrentTheme, toggleTheme } from './js/theme.js';
  import { handleLogin } from './js/authHelpers.js';

  // Svelte 5 runes for state management
  let idNumber = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let showPassword = $state(false);
  let errors = $state({ idNumber: '', password: '', general: '' });
  let loginAttemptsLeft = $state(null); // Track remaining login attempts
  let isAccountLocked = $state(false); // Track if account is locked
  
  // Forgot password state
  let showForgotPassword = $state(false);
  let forgotPasswordStep = $state(1); // 1: Email, 2: Code, 3: New Password
  let email = $state('');
  let resetToken = $state('');
  let verificationCode = $state('');
  let codeDigits = $state(['', '', '', '', '', '']); // Individual digits for the 6-box input
  let newPassword = $state('');
  let confirmPassword = $state('');
  let showNewPassword = $state(false);
  let showConfirmPassword = $state(false);
  let successMessage = $state('');
  let attemptsRemaining = $state(5);
  
  // Theme state (sync with already-set theme from app.html)
  let isDarkMode = $state(false);

  // Forgot password state persistence
  const FORGOT_PASSWORD_STORAGE_KEY = 'forgotPasswordState';

  function saveForgotPasswordState() {
    if (typeof window === 'undefined') return;
    try {
      const state = {
        showForgotPassword,
        forgotPasswordStep,
        email,
        resetToken,
        verificationCode,
        codeDigits,
        attemptsRemaining
      };
      sessionStorage.setItem(FORGOT_PASSWORD_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save forgot password state:', e);
    }
  }

  function loadForgotPasswordState() {
    if (typeof window === 'undefined') return;
    try {
      const saved = sessionStorage.getItem(FORGOT_PASSWORD_STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        showForgotPassword = state.showForgotPassword || false;
        forgotPasswordStep = state.forgotPasswordStep || 1;
        email = state.email || '';
        resetToken = state.resetToken || '';
        verificationCode = state.verificationCode || '';
        codeDigits = state.codeDigits || ['', '', '', '', '', ''];
        attemptsRemaining = state.attemptsRemaining || 5;
      }
    } catch (e) {
      console.warn('Failed to load forgot password state:', e);
    }
  }

  function clearForgotPasswordState() {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(FORGOT_PASSWORD_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear forgot password state:', e);
    }
  }

  // Sync component state with the theme set in app.html and restore forgot password state
  onMount(() => {
    const currentTheme = getCurrentTheme();
    isDarkMode = currentTheme === 'dark';
    
    // Restore forgot password state if it exists
    loadForgotPasswordState();
  });

  // Toggle theme mode
  function toggleDarkMode() {
    const newTheme = toggleTheme();
    isDarkMode = newTheme === 'dark';
  }
  
  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Reset errors and attempts
    errors = { idNumber: '', password: '', general: '' };
    loginAttemptsLeft = null;
    isAccountLocked = false;
    
    // Validate inputs
    const idNumberError = validateIdNumber(idNumber);
    const passwordError = validatePassword(password);
    
    if (idNumberError || passwordError) {
      errors = { idNumber: idNumberError, password: passwordError, general: '' };
      return;
    }
    
    isLoading = true;
    
    try {
      const result = await handleLogin({ accountNumber: idNumber, password });
      // Login successful - attempts tracking is handled in authHelpers
    } catch (error) {
      errors = { ...errors, general: error.message };
      
      // Check if error contains attempts info
      if (error.attemptsLeft !== undefined) {
        loginAttemptsLeft = error.attemptsLeft;
      }
      
      // Check if account is locked
      if (error.isLocked) {
        isAccountLocked = true;
        loginAttemptsLeft = 0;
      }
    } finally {
      isLoading = false;
    }
  };

  // Handle input changes with real-time validation
  const handleIdNumberChange = (event) => {
    idNumber = event.target.value;
    if (errors.idNumber) {
      errors = { ...errors, idNumber: validateIdNumber(idNumber) };
    }
  };

  const handlePasswordChange = (event) => {
    password = event.target.value;
    if (errors.password) {
      errors = { ...errors, password: validatePassword(password) };
    }
  };

  // Handle Enter key press in form fields
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  // Toggle forgot password view
  function toggleForgotPassword() {
    showForgotPassword = !showForgotPassword;
    if (!showForgotPassword) {
      // Reset forgot password form
      forgotPasswordStep = 1;
      email = '';
      resetToken = '';
      verificationCode = '';
      codeDigits = ['', '', '', '', '', ''];
      newPassword = '';
      confirmPassword = '';
      errors = { idNumber: '', password: '', general: '' };
      successMessage = '';
      attemptsRemaining = 5;
      // Clear saved state when going back to login
      clearForgotPasswordState();
    } else {
      // Save state when entering forgot password mode
      saveForgotPasswordState();
    }
  }

  // Handle individual digit input for verification code
  function handleDigitInput(index, event) {
    const input = event.target;
    const value = input.value.replace(/\D/g, ''); // Only allow numbers
    
    if (value.length > 0) {
      // Update the current digit
      codeDigits[index] = value[value.length - 1]; // Take only the last digit
      
      // Update the full verification code
      verificationCode = codeDigits.join('');
      
      // Auto-focus next input
      if (index < 5 && value) {
        const nextInput = document.getElementById(`code-digit-${index + 1}`);
        if (nextInput) {
          nextInput.focus();
        }
      } else if (index === 5 && codeDigits.every(digit => digit !== '')) {
        // All 6 digits are filled, automatically verify
        handleVerifyCode({ preventDefault: () => {} });
      }
    } else {
      codeDigits[index] = '';
      verificationCode = codeDigits.join('');
    }
  }

  // Handle backspace to move to previous input
  function handleDigitKeydown(index, event) {
    if (event.key === 'Backspace' && !codeDigits[index] && index > 0) {
      const prevInput = document.getElementById(`code-digit-${index - 1}`);
      if (prevInput) {
        prevInput.focus();
      }
    }
  }

  // Handle paste event for verification code
  function handleCodePaste(event) {
    event.preventDefault();
    const pastedData = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length > 0) {
      const digits = pastedData.split('');
      codeDigits = [...digits, ...Array(6 - digits.length).fill('')];
      verificationCode = codeDigits.join('');
      
      // Focus the last filled input or the first empty one
      const focusIndex = Math.min(digits.length, 5);
      const targetInput = document.getElementById(`code-digit-${focusIndex}`);
      if (targetInput) {
        targetInput.focus();
      }
      
      // If all 6 digits are filled from paste, automatically verify
      if (pastedData.length === 6) {
        handleVerifyCode({ preventDefault: () => {} });
      }
    }
  }

  // Handle verification code input (only allow numbers, max 6 digits) - Legacy method for compatibility
  function handleCodeChange(e) {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    verificationCode = value;
  }

  // Email validation
  function validateEmail(emailValue) {
    if (!emailValue) {
      return 'Email address is required';
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailValue)) {
      return 'Please enter a valid email address';
    }
    return '';
  }

  // Code validation
  function validateCode(code) {
    if (!code) {
      return 'Verification code is required';
    }
    if (!/^\d{6}$/.test(code)) {
      return 'Code must be 6 digits';
    }
    return '';
  }

  // Password validation for forgot password
  function validateNewPassword(pwd) {
    if (!pwd) {
      return 'Password is required';
    }
    if (pwd.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return '';
  }

  // Handle Step 1: Request reset code
  async function handleRequestCode(event) {
    event.preventDefault();
    errors = { idNumber: '', password: '', general: '' };
    successMessage = '';

    const emailError = validateEmail(email);
    if (emailError) {
      errors = { ...errors, general: emailError };
      return;
    }

    isLoading = true;

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset code');
      }

      resetToken = data.resetToken;
      successMessage = 'A verification code has been sent to your email address.';
      forgotPasswordStep = 2;
      // Save state after successful code request
      saveForgotPasswordState();
    } catch (error) {
      errors = { ...errors, general: error.message };
    } finally {
      isLoading = false;
    }
  }

  // Handle Step 2: Verify code
  async function handleVerifyCode(event) {
    event.preventDefault();
    errors = { idNumber: '', password: '', general: '' };
    successMessage = '';

    const codeError = validateCode(verificationCode);
    if (codeError) {
      errors = { ...errors, general: codeError };
      return;
    }

    isLoading = true;

    try {
      const response = await fetch('/api/forgot-password/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, code: verificationCode })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.attemptsRemaining !== undefined) {
          attemptsRemaining = data.attemptsRemaining;
        }
        throw new Error(data.error || 'Invalid verification code');
      }

      successMessage = 'Code verified! Please enter your new password.';
      forgotPasswordStep = 3;
      // Save state after successful code verification
      saveForgotPasswordState();
    } catch (error) {
      errors = { ...errors, general: error.message };
      // Save state even on error to preserve attemptsRemaining
      saveForgotPasswordState();
    } finally {
      isLoading = false;
    }
  }

  // Handle Step 3: Reset password
  async function handleResetPassword(event) {
    event.preventDefault();
    errors = { idNumber: '', password: '', general: '' };
    successMessage = '';

    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      errors = { ...errors, general: passwordError };
      return;
    }

    if (newPassword !== confirmPassword) {
      errors = { ...errors, general: 'Passwords do not match' };
      return;
    }

    isLoading = true;

    try {
      const response = await fetch('/api/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, code: verificationCode, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      successMessage = 'Password reset successfully! Redirecting to login...';
      
      // Clear saved state after successful password reset
      clearForgotPasswordState();
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        toggleForgotPassword();
      }, 2000);
    } catch (error) {
      errors = { ...errors, general: error.message };
    } finally {
      isLoading = false;
    }
  }


  // Resend code
  async function resendCode() {
    verificationCode = '';
    codeDigits = ['', '', '', '', '', ''];
    attemptsRemaining = 5;
    await handleRequestCode({ preventDefault: () => {} });
  }
</script>

<div class="login-container">
  <!-- Theme toggle button -->
  <button 
    class="theme-toggle-btn" 
    onclick={toggleDarkMode}
    aria-label="Toggle dark mode"
  >
    <span class="material-symbols-outlined">
      {isDarkMode ? 'light_mode' : 'dark_mode'}
    </span>
  </button>
  
  <!-- Login/Forgot Password Form Side (Left) -->
  <div class="left-side">
    {#if !showForgotPassword}
      <!-- Login Form -->
      <div class="login-header">
        <h1 class="login-title">Login</h1>
        <h2 class="login-subtitle">Enter your account details</h2>
      </div>
      
      <form class="login-form" onsubmit={handleSubmit} novalidate autocomplete="off">
        <!-- ID Number Field -->
        <div class="form-field">
          <div class="custom-text-field {errors.idNumber ? 'error' : ''}">
            <span class="leading-icon material-symbols-outlined">badge</span>
            <input
              type="text"
              value={idNumber}
              oninput={handleIdNumberChange}
              onkeydown={handleKeyDown}
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              class="text-input"
              placeholder=" "
            />
            <label class="text-label" for="idnumber-input">ID Number</label>
          </div>
          {#if errors.idNumber}
            <div class="error-text">{errors.idNumber}</div>
          {/if}
        </div>

        <!-- Password Field -->
        <div class="form-field">
          <div class="custom-text-field {errors.password ? 'error' : ''}">
            <span class="leading-icon material-symbols-outlined">lock</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              oninput={handlePasswordChange}
              onkeydown={handleKeyDown}
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              class="text-input"
              placeholder=" "
            />
            <label class="text-label" for="password-input">Password</label>
            <button
              type="button"
              class="trailing-icon-button"
              onclick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                showPassword = !showPassword;
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  showPassword = !showPassword;
                }
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <span class="material-symbols-outlined">{showPassword ? 'visibility' : 'visibility_off'}</span>
            </button>
          </div>
          {#if errors.password}
            <div class="error-text">{errors.password}</div>
          {/if}
        </div>

        <!-- Error Container -->
        {#if errors.idNumber || errors.password || errors.general}
          <div class="login-error-container">
            <span class="material-symbols-outlined">error</span>
            <div class="error-messages">
              {#if errors.idNumber}
                <div class="error-message-item">{errors.idNumber}</div>
              {/if}
              {#if errors.password}
                <div class="error-message-item">{errors.password}</div>
              {/if}
              {#if errors.general}
                <div class="error-message-item">{errors.general}</div>
              {/if}
              {#if loginAttemptsLeft !== null && loginAttemptsLeft > 0 && !isAccountLocked}
                <div class="error-message-item" style="color: #ff9800; font-weight: 500;">
                  {loginAttemptsLeft} attempt{loginAttemptsLeft !== 1 ? 's' : ''} remaining before login lockout
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Submit Button -->
        <button 
          id="login-submit-btn"
          type="submit" 
          class="custom-filled-button login-submit"
          disabled={isLoading || isAccountLocked}
          aria-label="Sign in"
        >
          {#if isLoading}
            <div class="login-loading-spinner"></div>
          {:else if isAccountLocked}
            <span>Login Locked</span>
          {:else}
            <span>Login</span>
          {/if}
        </button>

        <!-- Forgot password -->
        <button 
          type="button" 
          id="forgot-password-btn" 
          class="custom-text-button forgot-password" 
          aria-label="forgot-password"
          onclick={toggleForgotPassword}
        >
          Forgot Password
        </button>
      </form>
    {:else}
      <!-- Forgot Password Form -->
      <div class="login-header">
        <h1 class="login-title">
          {forgotPasswordStep === 1 ? 'Forgot Password?' : forgotPasswordStep === 2 ? 'Verify Code' : 'Reset Password'}
        </h1>
        <h2 class="login-subtitle">
          {forgotPasswordStep === 1
            ? 'Enter your email to receive a verification code'
            : forgotPasswordStep === 2
              ? 'Enter the 6-digit code sent to your email'
              : 'Create a new password for your account'}
        </h2>
      </div>

      <!-- Success/Error Messages -->
      {#if successMessage}
        <div class="success-message-box">
          <span class="material-symbols-outlined">check_circle</span>
          <span>{successMessage}</span>
        </div>
      {/if}

      {#if errors.general}
        <div class="error-message-box">
          <span class="material-symbols-outlined">error</span>
          <span>{errors.general}</span>
        </div>
      {/if}

      <!-- Step 1: Email Input -->
      {#if forgotPasswordStep === 1}
        <form class="login-form" onsubmit={handleRequestCode}>
          <div class="form-field">
            <div class="custom-text-field">
              <span class="leading-icon material-symbols-outlined">email</span>
              <input
                id="forgot-password-email"
                type="email"
                bind:value={email}
                autocomplete="email"
                class="text-input"
                placeholder=" "
                required
              />
              <label for="forgot-password-email" class="text-label">Email Address</label>
            </div>
          </div>

          <button 
            type="submit" 
            class="custom-filled-button login-submit"
            disabled={isLoading}
          >
            {#if isLoading}
              <div class="login-loading-spinner"></div>
            {:else}
              <span class="material-symbols-outlined">send</span>
              <span>Send Code</span>
            {/if}
          </button>
          <button class="back-to-login-btn" onclick={toggleForgotPassword} aria-label="Back to login">
            Back to Login
          </button>
        </form>
      {/if}

      <!-- Step 2: Code Verification -->
      {#if forgotPasswordStep === 2}
        <form class="login-form" onsubmit={(e) => { e.preventDefault(); }}>
          <div class="form-field">
            <div class="code-boxes-container">
              {#each codeDigits as digit, index}
                <input
                  id="code-digit-{index}"
                  type="text"
                  value={digit}
                  oninput={(e) => handleDigitInput(index, e)}
                  onkeydown={(e) => handleDigitKeydown(index, e)}
                  onpaste={index === 0 ? handleCodePaste : null}
                  maxlength="1"
                  inputmode="numeric"
                  autocomplete="off"
                  class="code-box"
                  required
                  disabled={isLoading}
                />
              {/each}
            </div>
            {#if attemptsRemaining < 5}
              <div class="info-text">Attempts remaining: {attemptsRemaining}</div>
            {/if}
            {#if isLoading}
              <div class="verification-loading">
                <div class="login-loading-spinner"></div>
                <span>Verifying code...</span>
              </div>
            {/if}
          </div>

          <button 
            type="button" 
            class="custom-filled-button login-submit"
            onclick={resendCode}
            disabled={isLoading}
          >
            {#if isLoading}
              <div class="login-loading-spinner"></div>
            {:else}
              <span class="material-symbols-outlined">refresh</span>
              <span>Resend Code</span>
            {/if}
          </button>

          <button class="back-to-login-btn" onclick={toggleForgotPassword} aria-label="Back to login">
            Back to Login
          </button>
        </form>
      {/if}

      <!-- Step 3: New Password -->
      {#if forgotPasswordStep === 3}
        <form class="login-form" onsubmit={handleResetPassword}>
          <div class="form-field">
            <div class="custom-text-field">
              <span class="leading-icon material-symbols-outlined">lock</span>
              <input
                id="reset-new-password"
                type={showNewPassword ? 'text' : 'password'}
                bind:value={newPassword}
                autocomplete="new-password"
                class="text-input"
                placeholder=" "
                required
              />
              <label for="reset-new-password" class="text-label">New Password</label>
              <button
                type="button"
                class="trailing-icon-button"
                onclick={(e) => {
                  e.preventDefault();
                  showNewPassword = !showNewPassword;
                }}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                <span class="material-symbols-outlined">{showNewPassword ? 'visibility' : 'visibility_off'}</span>
              </button>
            </div>
          </div>

          <div class="form-field">
            <div class="custom-text-field">
              <span class="leading-icon material-symbols-outlined">lock_reset</span>
              <input
                id="reset-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                bind:value={confirmPassword}
                autocomplete="new-password"
                class="text-input"
                placeholder=" "
                required
              />
              <label for="reset-confirm-password" class="text-label">Confirm Password</label>
              <button
                type="button"
                class="trailing-icon-button"
                onclick={(e) => {
                  e.preventDefault();
                  showConfirmPassword = !showConfirmPassword;
                }}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <span class="material-symbols-outlined">{showConfirmPassword ? 'visibility' : 'visibility_off'}</span>
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            class="custom-filled-button login-submit"
            disabled={isLoading}
          >
            {#if isLoading}
              <div class="login-loading-spinner"></div>
            {:else}
              <span>Reset Password</span>
            {/if}
          </button>

          <button class="back-to-login-btn" onclick={toggleForgotPassword} aria-label="Back to login">
            Back to Login
          </button>
        </form>
      {/if}
    {/if}
  </div>
  
  <!-- Image Side (Right) -->
  <div class="right-side">
    <!-- Welcome text -->
    <div class="welcome-text">
      <h1 class="welcome-title">{showForgotPassword ? 'Password Reset' : 'Welcome'}</h1>
      <p class="welcome-subtitle">
        {showForgotPassword ? 'Recover your account securely' : 'Login to access your account'}
      </p>
    </div>
  </div>
</div>
