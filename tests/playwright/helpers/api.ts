import { APIRequestContext } from '@playwright/test';

/**
 * API helper functions for testing
 */
export class ApiHelper {
  constructor(private request: APIRequestContext) {}

  /**
   * Get API base URL
   */
  private get baseURL(): string {
    return process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
  }

  /**
   * Create a new project via API
   */
  async createProject(data: {
    name: string;
    key: string;
    description?: string;
  }) {
    const response = await this.request.post(`${this.baseURL}/projects`, {
      data,
    });
    return response.json();
  }

  /**
   * Delete a project via API
   */
  async deleteProject(projectId: string) {
    return this.request.delete(`${this.baseURL}/projects/${projectId}`);
  }

  /**
   * List all projects
   */
  async listProjects() {
    const response = await this.request.get(`${this.baseURL}/projects`);
    return response.json();
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string) {
    const response = await this.request.get(
      `${this.baseURL}/projects/${projectId}`
    );
    return response.json();
  }

  /**
   * Check health endpoint
   */
  async checkHealth() {
    const response = await this.request.get(`${this.baseURL}/health`);
    return response.json();
  }

  /**
   * Get OAuth integration status
   */
  async getOAuthStatus(projectId: string, provider: string) {
    const response = await this.request.get(
      `${this.baseURL}/auth/${provider}/status?projectId=${projectId}`
    );
    return response.json();
  }

  /**
   * Start a workflow
   */
  async startWorkflow(data: {
    projectId: string;
    taskId: string;
    phase: string;
  }) {
    const response = await this.request.post(`${this.baseURL}/workflows`, {
      data,
    });
    return response.json();
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string) {
    const response = await this.request.get(
      `${this.baseURL}/workflows/${workflowId}`
    );
    return response.json();
  }
}
