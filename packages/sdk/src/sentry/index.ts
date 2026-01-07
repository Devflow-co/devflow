/**
 * Sentry Integration Module
 *
 * Exports Sentry client and types for context extraction.
 */

export { SentryClient, createSentryClient } from './sentry.client';
export {
  SentryIntegrationService,
  createSentryIntegrationService,
} from './sentry-integration.service';
export type {
  SentryIssue,
  SentryEvent,
  SentryIssueContext,
  SentryStacktrace,
  SentryStackFrame,
  SentryTag,
  SentryProject,
  SentryOrganization,
  SentryProjectDetail,
} from './sentry.types';
