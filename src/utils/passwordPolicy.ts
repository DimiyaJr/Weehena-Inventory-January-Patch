// Password validation utilities

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength?: 'weak' | 'medium' | 'strong';
}

// Validate user-set passwords (standard security)
export const validateUserPassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  const strength = calculatePasswordStrength(password);
  
  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
};

// Validate temporary passwords (simple - letters and numbers only)
export const validateTemporaryPassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  
  if (password.length < 6) {
    errors.push('Temporary password must be at least 6 characters long');
  }
  
  if (!/^[a-zA-Z0-9]+$/.test(password)) {
    errors.push('Temporary password can only contain letters and numbers');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Calculate password strength
const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
};

// Get password requirements message for users
export const getUserPasswordRequirements = (): string[] => {
  return [
    'At least 8 characters long',
    'At least one lowercase letter (a-z)',
    'At least one uppercase letter (A-Z)',
    'At least one number (0-9)',
    'At least one special character (!@#$%^&* etc.)'
  ];
};

// Get temporary password requirements message
export const getTemporaryPasswordRequirements = (): string[] => {
  return [
    'At least 6 characters long',
    'Only letters and numbers allowed',
    'No special characters or spaces'
  ];
};
