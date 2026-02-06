/**
 * Code Generation Activities - Module Index
 *
 * Re-exports all code generation activities from split files.
 */

// Types
export * from './types';

// Main code generation
export {
  generateCodeFromPlan,
  resetCircuitBreaker,
  getCircuitBreakerState,
} from './generate-code.activities';

// File fetching
export { fetchFilesFromGitHub } from './fetch-files.activities';

// Failure analysis
export {
  analyzeFailuresWithAI,
  determineFailedPhase,
  extractErrorDetails,
} from './analyze-failures.activities';

// V3: Ambiguity detection
export { detectAmbiguityBeforeGeneration } from './ambiguity-detection.activities';

// V3: Solution detection
export { detectMultipleSolutions } from './solution-detection.activities';
