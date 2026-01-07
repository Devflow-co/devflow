/**
 * Sentry API Types
 *
 * Types for Sentry issue and event data used in context extraction.
 */

export interface SentryStackFrame {
  filename: string;
  function: string;
  lineNo: number;
  colNo?: number;
  context?: string[];
  absPath?: string;
  module?: string;
  inApp?: boolean;
}

export interface SentryStacktrace {
  frames: SentryStackFrame[];
}

export interface SentryTag {
  key: string;
  value: string;
}

export interface SentryProject {
  id: string;
  name: string;
  slug: string;
}

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  permalink: string;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  status: 'resolved' | 'unresolved' | 'ignored';
  platform: string;
  project: SentryProject;
  type: string;
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  tags: Array<{ key: string; value: string; name: string }>;
}

export interface SentryEvent {
  eventID: string;
  context?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  dateCreated: string;
  dateReceived: string;
  entries: Array<{
    type: string;
    data: unknown;
  }>;
  message?: string;
  platform: string;
  sdk?: {
    name: string;
    version: string;
  };
  tags: Array<{ key: string; value: string }>;
  title: string;
  type: string;
  user?: {
    id?: string;
    email?: string;
    username?: string;
    ipAddress?: string;
  };
}

/**
 * Sentry issue context for refinement
 * Simplified structure for AI consumption
 */
export interface SentryIssueContext {
  issueId: string;
  title: string;
  shortId: string;
  culprit: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  status: string;
  level: string;
  platform: string;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  stacktrace?: SentryStacktrace;
  tags: SentryTag[];
  errorMessage?: string;
  errorType?: string;
}

/**
 * Sentry Organization
 * Represents an organization the user has access to
 */
export interface SentryOrganization {
  id: string;
  slug: string;
  name: string;
  status: {
    id: string;
    name: string;
  };
  avatar?: {
    avatarType: string;
    avatarUuid?: string;
  };
  dateCreated?: string;
}

/**
 * Sentry Project Detail
 * Extended project info returned by organizations/{org}/projects endpoint
 */
export interface SentryProjectDetail {
  id: string;
  slug: string;
  name: string;
  platform?: string;
  dateCreated: string;
  isBookmarked: boolean;
  isMember: boolean;
  hasAccess: boolean;
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  color?: string;
  features?: string[];
}
