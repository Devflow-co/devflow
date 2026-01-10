/**
 * Container Executor Service - Phase 4 V2
 *
 * Manages ephemeral Docker containers for isolated code execution.
 * Uses dockerode for container lifecycle management.
 */

import Docker from 'dockerode';
import { Readable } from 'stream';
import type {
  ExecuteInContainerInput,
  ExecuteInContainerOutput,
  ContainerPhaseResult,
  GeneratedFile,
} from '@devflow/common';

export interface ContainerExecutorOptions {
  /** Docker host URL (default: unix socket) */
  dockerHost?: string;
  /** Memory limit (default: 2g) */
  defaultMemory?: string;
  /** CPU shares (default: 1024 = 1 CPU) */
  defaultCpuShares?: number;
  /** Timeout in milliseconds (default: 600000 = 10 min) */
  defaultTimeout?: number;
  /** Max concurrent containers (default: 5) */
  maxConcurrent?: number;
}

interface RunCommandOptions {
  container: Docker.Container;
  command: string[];
  workDir?: string;
  env?: string[];
  timeout?: number;
}

interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export class ContainerExecutorService {
  private docker: Docker;
  private options: Required<ContainerExecutorOptions>;
  private activeContainers: Set<string> = new Set();

  constructor(options: ContainerExecutorOptions = {}) {
    this.options = {
      dockerHost: options.dockerHost || '/var/run/docker.sock',
      defaultMemory: options.defaultMemory || '2g',
      defaultCpuShares: options.defaultCpuShares || 1024,
      defaultTimeout: options.defaultTimeout || 600000,
      maxConcurrent: options.maxConcurrent || 5,
    };

    this.docker = new Docker({
      socketPath: this.options.dockerHost,
    });
  }

  /**
   * Execute code generation validation in an isolated container
   */
  async execute(input: ExecuteInContainerInput): Promise<ExecuteInContainerOutput> {
    const startTime = Date.now();
    const { projectId, taskId, repository, generatedFiles, commands, timeout, image, memory } =
      input;

    const containerImage = image || 'node:20-alpine';
    const containerMemory = memory || this.options.defaultMemory;
    const containerTimeout = timeout || this.options.defaultTimeout;

    // Check concurrent container limit
    if (this.activeContainers.size >= this.options.maxConcurrent) {
      throw new Error(
        `Max concurrent containers (${this.options.maxConcurrent}) reached. Try again later.`
      );
    }

    let container: Docker.Container | null = null;
    const logs: string[] = [];

    const output: ExecuteInContainerOutput = {
      success: false,
      exitCode: 1,
      phases: {
        clone: { success: false, exitCode: 1, output: '', duration: 0 },
        applyFiles: { success: false, exitCode: 1, output: '', duration: 0 },
        install: { success: false, exitCode: 1, output: '', duration: 0 },
      },
      logs: '',
      duration: 0,
    };

    try {
      // Ensure image exists
      await this.ensureImage(containerImage);

      // Create container
      container = await this.createContainer({
        image: containerImage,
        memory: containerMemory,
        taskId,
        timeout: containerTimeout,
      });

      this.activeContainers.add(container.id);
      await container.start();

      logs.push(`[Container] Started container ${container.id.substring(0, 12)}`);
      logs.push(`[Container] Image: ${containerImage}, Memory: ${containerMemory}`);

      // Phase 1: Clone repository
      output.phases.clone = await this.runPhase(container, 'clone', async () => {
        return this.cloneRepository(container!, repository, input.projectId);
      });
      logs.push(`[Clone] ${output.phases.clone.success ? 'SUCCESS' : 'FAILED'}`);
      logs.push(output.phases.clone.output);

      if (!output.phases.clone.success) {
        output.failedPhase = 'clone';
        output.exitCode = output.phases.clone.exitCode;
        output.logs = logs.join('\n');
        output.duration = Date.now() - startTime;
        return output;
      }

      // Phase 2: Apply generated files
      output.phases.applyFiles = await this.runPhase(container, 'applyFiles', async () => {
        return this.applyGeneratedFiles(container!, generatedFiles);
      });
      logs.push(`[ApplyFiles] ${output.phases.applyFiles.success ? 'SUCCESS' : 'FAILED'}`);
      logs.push(output.phases.applyFiles.output);

      if (!output.phases.applyFiles.success) {
        output.failedPhase = 'applyFiles';
        output.exitCode = output.phases.applyFiles.exitCode;
        output.logs = logs.join('\n');
        output.duration = Date.now() - startTime;
        return output;
      }

      // Phase 3: Install dependencies
      const installCmd = commands.install || 'npm ci';
      output.phases.install = await this.runPhase(container, 'install', async () => {
        return this.runCommand({
          container: container!,
          command: ['sh', '-c', installCmd],
          workDir: '/workspace',
          timeout: containerTimeout / 2, // Half timeout for install
        });
      });
      logs.push(`[Install] ${output.phases.install.success ? 'SUCCESS' : 'FAILED'}`);
      logs.push(output.phases.install.output);

      if (!output.phases.install.success) {
        output.failedPhase = 'install';
        output.exitCode = output.phases.install.exitCode;
        output.logs = logs.join('\n');
        output.duration = Date.now() - startTime;
        return output;
      }

      // Phase 4: Lint (optional)
      if (commands.lint) {
        output.phases.lint = await this.runPhase(container, 'lint', async () => {
          return this.runCommand({
            container: container!,
            command: ['sh', '-c', commands.lint!],
            workDir: '/workspace',
            timeout: 120000, // 2 min for lint
          });
        });
        logs.push(`[Lint] ${output.phases.lint.success ? 'SUCCESS' : 'FAILED'}`);
        logs.push(output.phases.lint.output);

        if (!output.phases.lint.success) {
          output.failedPhase = 'lint';
          output.exitCode = output.phases.lint.exitCode;
          output.logs = logs.join('\n');
          output.duration = Date.now() - startTime;
          return output;
        }
      }

      // Phase 5: Typecheck (optional)
      if (commands.typecheck) {
        output.phases.typecheck = await this.runPhase(container, 'typecheck', async () => {
          return this.runCommand({
            container: container!,
            command: ['sh', '-c', commands.typecheck!],
            workDir: '/workspace',
            timeout: 180000, // 3 min for typecheck
          });
        });
        logs.push(`[Typecheck] ${output.phases.typecheck.success ? 'SUCCESS' : 'FAILED'}`);
        logs.push(output.phases.typecheck.output);

        if (!output.phases.typecheck.success) {
          output.failedPhase = 'typecheck';
          output.exitCode = output.phases.typecheck.exitCode;
          output.logs = logs.join('\n');
          output.duration = Date.now() - startTime;
          return output;
        }
      }

      // Phase 6: Tests (optional)
      if (commands.test) {
        output.phases.test = await this.runPhase(container, 'test', async () => {
          return this.runCommand({
            container: container!,
            command: ['sh', '-c', commands.test!],
            workDir: '/workspace',
            timeout: containerTimeout / 2, // Half timeout for tests
          });
        });
        logs.push(`[Test] ${output.phases.test.success ? 'SUCCESS' : 'FAILED'}`);
        logs.push(output.phases.test.output);

        if (!output.phases.test.success) {
          output.failedPhase = 'test';
          output.exitCode = output.phases.test.exitCode;
          // Parse test results if available
          output.testResults = this.parseTestResults(output.phases.test.output);
          output.logs = logs.join('\n');
          output.duration = Date.now() - startTime;
          return output;
        }

        // Parse successful test results
        output.testResults = this.parseTestResults(output.phases.test.output);
      }

      // All phases passed
      output.success = true;
      output.exitCode = 0;
      output.logs = logs.join('\n');
      output.duration = Date.now() - startTime;

      logs.push(`[Container] All phases completed successfully in ${output.duration}ms`);
      output.logs = logs.join('\n');

      return output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logs.push(`[Error] Container execution failed: ${errorMessage}`);
      output.logs = logs.join('\n');
      output.duration = Date.now() - startTime;
      throw error;
    } finally {
      // Cleanup container
      if (container) {
        await this.cleanup(container.id);
        this.activeContainers.delete(container.id);
      }
    }
  }

  /**
   * Ensure Docker image is available locally
   */
  private async ensureImage(imageName: string): Promise<void> {
    try {
      await this.docker.getImage(imageName).inspect();
    } catch {
      // Image not found, pull it
      console.log(`[Docker] Pulling image: ${imageName}`);
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            reject(err);
            return;
          }
          this.docker.modem.followProgress(stream, (pullErr: Error | null) => {
            if (pullErr) {
              reject(pullErr);
            } else {
              resolve();
            }
          });
        });
      });
    }
  }

  /**
   * Create a new ephemeral container
   */
  private async createContainer(options: {
    image: string;
    memory: string;
    taskId: string;
    timeout: number;
  }): Promise<Docker.Container> {
    const { image, memory, taskId } = options;

    // Parse memory string (e.g., "2g" -> 2147483648)
    const memoryBytes = this.parseMemory(memory);

    return this.docker.createContainer({
      Image: image,
      name: `devflow-task-${taskId}-${Date.now()}`,
      Tty: false,
      OpenStdin: false,
      WorkingDir: '/workspace',
      Cmd: ['sh', '-c', 'tail -f /dev/null'], // Keep container running
      HostConfig: {
        Memory: memoryBytes,
        MemorySwap: memoryBytes, // Same as memory (no swap)
        CpuShares: this.options.defaultCpuShares,
        PidsLimit: 512, // Prevent fork bomb
        AutoRemove: true, // Auto cleanup on stop
        NetworkMode: 'bridge', // Allow network for clone, will be restricted later
        CapDrop: ['ALL'], // Drop all capabilities
        CapAdd: ['CHOWN', 'SETUID', 'SETGID'], // Minimal capabilities for npm
        SecurityOpt: ['no-new-privileges'],
      },
      Labels: {
        'devflow.task.id': taskId,
        'devflow.container.type': 'code-generation',
      },
    });
  }

  /**
   * Run a phase and capture results
   */
  private async runPhase(
    container: Docker.Container,
    phaseName: string,
    fn: () => Promise<RunCommandResult>
  ): Promise<ContainerPhaseResult> {
    const startTime = Date.now();
    try {
      const result = await fn();
      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        output: `${result.stdout}\n${result.stderr}`.trim(),
        duration: result.duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        exitCode: 1,
        output: `Phase ${phaseName} failed: ${errorMessage}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Clone repository into container
   */
  private async cloneRepository(
    container: Docker.Container,
    repository: { owner: string; repo: string; branch: string },
    projectId: string
  ): Promise<RunCommandResult> {
    const { owner, repo, branch } = repository;

    // Token will be injected via environment by the activity
    const cloneUrl = `https://\${GITHUB_TOKEN}@github.com/${owner}/${repo}.git`;

    return this.runCommand({
      container,
      command: [
        'sh',
        '-c',
        `git clone --depth 1 --branch ${branch} ${cloneUrl} /workspace && cd /workspace && git checkout ${branch}`,
      ],
      timeout: 120000, // 2 min for clone
    });
  }

  /**
   * Apply generated files to the workspace
   */
  private async applyGeneratedFiles(
    container: Docker.Container,
    files: GeneratedFile[]
  ): Promise<RunCommandResult> {
    const startTime = Date.now();
    const outputs: string[] = [];

    try {
      for (const file of files) {
        if (file.action === 'delete') {
          // Delete file
          const deleteResult = await this.runCommand({
            container,
            command: ['rm', '-f', `/workspace/${file.path}`],
            timeout: 5000,
          });
          outputs.push(`Deleted: ${file.path}`);
        } else {
          // Create or modify file
          // Ensure directory exists
          const dir = file.path.split('/').slice(0, -1).join('/');
          if (dir) {
            await this.runCommand({
              container,
              command: ['mkdir', '-p', `/workspace/${dir}`],
              timeout: 5000,
            });
          }

          // Write file content using base64 to avoid escaping issues
          const base64Content = Buffer.from(file.content).toString('base64');
          await this.runCommand({
            container,
            command: [
              'sh',
              '-c',
              `echo '${base64Content}' | base64 -d > /workspace/${file.path}`,
            ],
            timeout: 10000,
          });
          outputs.push(`${file.action === 'create' ? 'Created' : 'Modified'}: ${file.path}`);
        }
      }

      return {
        exitCode: 0,
        stdout: outputs.join('\n'),
        stderr: '',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        exitCode: 1,
        stdout: outputs.join('\n'),
        stderr: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run a command inside the container
   */
  private async runCommand(options: RunCommandOptions): Promise<RunCommandResult> {
    const { container, command, workDir, env, timeout } = options;
    const startTime = Date.now();

    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: workDir || '/workspace',
      Env: env,
    });

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout || this.options.defaultTimeout);

      exec.start({ hijack: true, stdin: false }, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          reject(err);
          return;
        }

        if (!stream) {
          clearTimeout(timeoutId);
          reject(new Error('No stream returned from exec'));
          return;
        }

        let stdout = '';
        let stderr = '';

        // Demux the stream
        const stdoutStream = new Readable({ read() {} });
        const stderrStream = new Readable({ read() {} });

        container.modem.demuxStream(stream, stdoutStream, stderrStream);

        stdoutStream.on('data', (chunk) => {
          stdout += chunk.toString();
        });

        stderrStream.on('data', (chunk) => {
          stderr += chunk.toString();
        });

        stream.on('end', async () => {
          clearTimeout(timeoutId);
          try {
            const inspectData = await exec.inspect();
            resolve({
              exitCode: inspectData.ExitCode ?? 1,
              stdout,
              stderr,
              duration: Date.now() - startTime,
            });
          } catch (inspectErr) {
            resolve({
              exitCode: 1,
              stdout,
              stderr: stderr + '\n' + String(inspectErr),
              duration: Date.now() - startTime,
            });
          }
        });

        stream.on('error', (streamErr) => {
          clearTimeout(timeoutId);
          reject(streamErr);
        });
      });
    });
  }

  /**
   * Parse test output to extract results
   */
  private parseTestResults(output: string): ExecuteInContainerOutput['testResults'] {
    // Try to parse Jest/Vitest output
    const passedMatch = output.match(/(\d+)\s+pass(?:ed|ing)?/i);
    const failedMatch = output.match(/(\d+)\s+fail(?:ed|ing)?/i);
    const skippedMatch = output.match(/(\d+)\s+skip(?:ped)?/i);
    const durationMatch = output.match(/Time:\s*(\d+(?:\.\d+)?)\s*s/i);

    const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
    const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;

    return {
      success: failed === 0,
      passed,
      failed,
      skipped,
      duration,
      logs: output,
    };
  }

  /**
   * Parse memory string to bytes
   */
  private parseMemory(memory: string): number {
    const match = memory.match(/^(\d+)(k|m|g)?$/i);
    if (!match) {
      return 2 * 1024 * 1024 * 1024; // Default 2GB
    }

    const value = parseInt(match[1], 10);
    const unit = (match[2] || 'b').toLowerCase();

    switch (unit) {
      case 'k':
        return value * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'g':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  /**
   * Cleanup a container
   */
  async cleanup(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      if (info.State.Running) {
        await container.stop({ t: 5 }); // 5 second grace period
      }

      // Container should auto-remove, but try explicit remove if needed
      try {
        await container.remove({ force: true });
      } catch {
        // Ignore - container may have already been removed
      }
    } catch (error) {
      // Container may already be removed
      console.log(`[Docker] Cleanup for ${containerId.substring(0, 12)}: already removed`);
    }
  }

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get active container count
   */
  getActiveContainerCount(): number {
    return this.activeContainers.size;
  }
}
