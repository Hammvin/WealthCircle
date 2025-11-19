// Kenyan Phone Number Utilities
export const KenyanPhoneUtils = {
  validate: (phone: string): boolean => {
    // ... (your existing KenyanPhoneUtils implementation)
  },
  normalizeToInternational: (phone: string): string => {
    // ... (your existing implementation)
  },
  // ... rest of KenyanPhoneUtils
};

// Enhanced error handling
export const handleDatabaseError = (error: any, context: string): { success: false; error: string } => {
  // ... (your existing handleDatabaseError implementation)
};

// Permission validation
export const validateChamaAccess = async (chamaId: string, userId?: string): Promise<{ success: boolean; error?: string }> => {
  // ... (your existing implementation)
};

// Safe query execution
export const executeSafeQuery = async <T>(
  query: Promise<{ data: T | null; error: any }>,
  context: string
): Promise<{ success: boolean; data?: T; error?: string }> => {
  // ... (your existing implementation)
};

// Export security utilities
export const Security = {
  KenyanPhoneUtils,
  validateInput: {
    phone: KenyanPhoneUtils.validate,
    email: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    // ... other validators
  },
};