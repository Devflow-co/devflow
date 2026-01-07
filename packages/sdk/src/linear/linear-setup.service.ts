/**
 * Linear Setup Service
 *
 * Handles automatic setup of Linear workspace for DevFlow integration:
 * - Custom Fields (Figma URL, Sentry URL, GitHub Issue URL)
 * - Workflow States validation and creation
 */

import { createLogger } from '@devflow/common';
import { LinearClient, LinearCustomField } from './linear.client';

const logger = createLogger('LinearSetupService');

/**
 * DevFlow custom fields that should be created in Linear
 */
export const DEVFLOW_CUSTOM_FIELDS = {
  FIGMA_URL: 'Figma URL',
  SENTRY_URL: 'Sentry URL',
  GITHUB_ISSUE_URL: 'GitHub Issue URL',
} as const;

export type DevFlowCustomFieldKey = keyof typeof DEVFLOW_CUSTOM_FIELDS;

/**
 * Linear workflow state type
 */
export type LinearWorkflowStateType = 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

/**
 * DevFlow workflow states that should exist in Linear
 * Maps each state to its Linear type and optional color
 */
export const DEVFLOW_WORKFLOW_STATES: Array<{
  name: string;
  type: LinearWorkflowStateType;
  color?: string;
}> = [
  // Backlog
  { name: 'Backlog', type: 'backlog', color: '#bec2c8' },

  // Phase 1: Refinement
  { name: 'To Refinement', type: 'unstarted', color: '#e2e2e2' },
  { name: 'Refinement In Progress', type: 'started', color: '#f2c94c' },
  { name: 'Refinement Ready', type: 'started', color: '#27ae60' },
  { name: 'Refinement Failed', type: 'canceled', color: '#eb5757' },

  // Phase 2: User Story
  { name: 'To User Story', type: 'unstarted', color: '#e2e2e2' },
  { name: 'UserStory In Progress', type: 'started', color: '#56ccf2' },
  { name: 'UserStory Ready', type: 'started', color: '#6fcf97' },
  { name: 'UserStory Failed', type: 'canceled', color: '#eb5757' },

  // Phase 3: Technical Plan
  { name: 'To Plan', type: 'unstarted', color: '#e2e2e2' },
  { name: 'Plan In Progress', type: 'started', color: '#bb6bd9' },
  { name: 'Plan Ready', type: 'completed', color: '#27ae60' },
  { name: 'Plan Failed', type: 'canceled', color: '#eb5757' },

  // Generic states
  { name: 'In Review', type: 'started', color: '#9b51e0' },
  { name: 'Done', type: 'completed', color: '#219653' },
  { name: 'Blocked', type: 'started', color: '#eb5757' },
];

export interface SetupCustomFieldsResult {
  created: string[];
  existing: string[];
  fieldIds: Record<DevFlowCustomFieldKey, string>;
}

export interface ValidateSetupResult {
  valid: boolean;
  missing: string[];
  fieldIds: Record<string, string>;
}

export interface ValidateWorkflowStatesResult {
  valid: boolean;
  existingStates: Array<{ name: string; id: string; type: string; color?: string }>;
  missingStates: string[];
  totalRequired: number;
}

export interface CreateWorkflowStatesResult {
  created: string[];
  existing: string[];
  errors: Array<{ name: string; error: string }>;
}

export class LinearSetupService {
  constructor(private client: LinearClient) {}

  /**
   * Ensure all DevFlow custom fields exist in the Linear team
   * Creates any missing fields and returns the IDs of all fields
   */
  async ensureCustomFields(teamId: string): Promise<SetupCustomFieldsResult> {
    logger.info('Ensuring DevFlow custom fields exist', { teamId });

    const existingFields = await this.client.getCustomFields(teamId);
    const created: string[] = [];
    const existing: string[] = [];
    const fieldIds: Record<string, string> = {};

    for (const [key, name] of Object.entries(DEVFLOW_CUSTOM_FIELDS)) {
      const existingField = existingFields.find(
        (f) => f.name.toLowerCase() === name.toLowerCase()
      );

      if (existingField) {
        fieldIds[key] = existingField.id;
        existing.push(name);
        logger.info('Custom field already exists', { name, id: existingField.id });
      } else {
        try {
          const newField = await this.client.createCustomField(teamId, name, 'text');
          fieldIds[key] = newField.id;
          created.push(name);
          logger.info('Custom field created', { name, id: newField.id });
        } catch (error) {
          logger.error('Failed to create custom field', error as Error, { name });
          throw new Error(`Failed to create custom field "${name}": ${(error as Error).message}`);
        }
      }
    }

    logger.info('Custom fields setup complete', {
      teamId,
      created: created.length,
      existing: existing.length,
    });

    return {
      created,
      existing,
      fieldIds: fieldIds as Record<DevFlowCustomFieldKey, string>,
    };
  }

  /**
   * Validate that all DevFlow custom fields exist
   * Does not create any fields, just checks
   */
  async validateSetup(teamId: string): Promise<ValidateSetupResult> {
    logger.info('Validating DevFlow custom fields', { teamId });

    const existingFields = await this.client.getCustomFields(teamId);
    const missing: string[] = [];
    const fieldIds: Record<string, string> = {};

    for (const [key, name] of Object.entries(DEVFLOW_CUSTOM_FIELDS)) {
      const existingField = existingFields.find(
        (f) => f.name.toLowerCase() === name.toLowerCase()
      );

      if (existingField) {
        fieldIds[key] = existingField.id;
      } else {
        missing.push(name);
      }
    }

    const valid = missing.length === 0;

    logger.info('Validation complete', {
      teamId,
      valid,
      missing,
    });

    return {
      valid,
      missing,
      fieldIds,
    };
  }

  /**
   * Get custom field values from an issue and map to DevFlow fields
   */
  async getDevFlowFieldValues(
    issueId: string
  ): Promise<{
    figmaUrl?: string;
    sentryUrl?: string;
    githubIssueUrl?: string;
  }> {
    const customFields = await this.client.getIssueCustomFields(issueId);

    return {
      figmaUrl: customFields.get(DEVFLOW_CUSTOM_FIELDS.FIGMA_URL),
      sentryUrl: customFields.get(DEVFLOW_CUSTOM_FIELDS.SENTRY_URL),
      githubIssueUrl: customFields.get(DEVFLOW_CUSTOM_FIELDS.GITHUB_ISSUE_URL),
    };
  }

  // ============================================
  // Workflow States Operations
  // ============================================

  /**
   * Validate which DevFlow workflow states exist in a Linear team
   */
  async validateWorkflowStates(teamId: string): Promise<ValidateWorkflowStatesResult> {
    logger.info('Validating DevFlow workflow states', { teamId });

    const existingStates = await this.client.getWorkflowStates(teamId);
    const missingStates: string[] = [];
    const foundStates: Array<{ name: string; id: string; type: string; color?: string }> = [];

    for (const requiredState of DEVFLOW_WORKFLOW_STATES) {
      const existing = existingStates.find(
        (s) => s.name.toLowerCase() === requiredState.name.toLowerCase()
      );

      if (existing) {
        foundStates.push({
          name: existing.name,
          id: existing.id,
          type: existing.type,
          color: existing.color,
        });
      } else {
        missingStates.push(requiredState.name);
      }
    }

    const valid = missingStates.length === 0;

    logger.info('Workflow states validation complete', {
      teamId,
      valid,
      existingCount: foundStates.length,
      missingCount: missingStates.length,
    });

    return {
      valid,
      existingStates: foundStates,
      missingStates,
      totalRequired: DEVFLOW_WORKFLOW_STATES.length,
    };
  }

  /**
   * Create missing DevFlow workflow states in a Linear team
   */
  async createMissingWorkflowStates(teamId: string): Promise<CreateWorkflowStatesResult> {
    logger.info('Creating missing DevFlow workflow states', { teamId });

    const validation = await this.validateWorkflowStates(teamId);
    const created: string[] = [];
    const existing: string[] = validation.existingStates.map((s) => s.name);
    const errors: Array<{ name: string; error: string }> = [];

    for (const requiredState of DEVFLOW_WORKFLOW_STATES) {
      if (validation.missingStates.includes(requiredState.name)) {
        try {
          await this.client.createWorkflowState(
            teamId,
            requiredState.name,
            requiredState.type,
            requiredState.color
          );
          created.push(requiredState.name);
          logger.info('Created workflow state', { name: requiredState.name });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ name: requiredState.name, error: errorMessage });
          logger.error('Failed to create workflow state', error as Error, { name: requiredState.name });
        }
      }
    }

    logger.info('Workflow states creation complete', {
      teamId,
      created: created.length,
      existing: existing.length,
      errors: errors.length,
    });

    return { created, existing, errors };
  }
}

/**
 * Create a LinearSetupService instance
 */
export function createLinearSetupService(client: LinearClient): LinearSetupService {
  return new LinearSetupService(client);
}
