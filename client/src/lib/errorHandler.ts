// Comprehensive error handling utilities
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// API Error Handler
export const handleApiError = (error: any): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  // Network errors
  if (!error.response) {
    return new AppError('Network error - please check your connection', 0);
  }

  // HTTP errors
  const status = error.response?.status || 500;
  const message = error.response?.data?.message || error.message || 'An unexpected error occurred';

  return new AppError(message, status);
};

// Promise wrapper that never rejects
export const safeAsync = async <T>(
  promise: Promise<T>,
  fallback?: T
): Promise<{ data: T | null; error: AppError | null }> => {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (err) {
    const error = handleApiError(err);
    console.error('Safe async error:', error.message);

    return {
      data: fallback || null,
      error
    };
  }
};

// Query wrapper for React Query
export const safeQuery = <T>(queryFn: () => Promise<T>, fallback?: T) => {
  return async (): Promise<T> => {
    const { data, error } = await safeAsync(queryFn(), fallback);

    if (error && !data) {
      // Log error but don't throw - return fallback instead
      console.warn('Query failed, using fallback:', error.message);
      return fallback as T;
    }

    return data as T;
  };
};

// Notification helper for user-facing errors
export const notifyError = (error: AppError | string) => {
  const message = typeof error === 'string' ? error : error.message;

  // You can integrate with your toast system here
  console.error('User notification:', message);

  // Example toast integration:
  // toast.error(message);
};

export const handleError = (error: Error, context?: string) => {
  console.error(`Error ${context ? `in ${context}` : ''}:`, error);
};

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  handleError(new Error(event.reason), 'unhandled promise');
  event.preventDefault();
});