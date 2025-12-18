/**
 * Application Logger
 * 
 * Centralized logging utility with automatic dev/prod awareness.
 * Use this instead of direct console.* calls for better control
 * over logging behavior in different environments.
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('User action:', action);
 *   logger.info('Feature enabled:', featureName);
 *   logger.warn('Deprecated API called');
 *   logger.error('Operation failed:', error);
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  
  error: (...args: any[]) => {
    console.error(...args);
  },
};
