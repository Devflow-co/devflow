/**
 * DevFlow CLI - init command
 * Phase 7: UX & CLI
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';

interface InitOptions {
  monorepo?: boolean;
  stack?: string;
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Initialize DevFlow in current directory
 */
export async function initCommand(options: InitOptions = {}) {
  console.log(chalk.cyan.bold('🚀 DevFlow Initialization'));
  console.log();

  // Check if .devflow.yml already exists
  const configPath = path.join(process.cwd(), '.devflow.yml');
  const exists = await fileExists(configPath);

  if (exists && !options.force) {
    console.log(chalk.yellow('⚠️  .devflow.yml already exists!'));
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: 'Do you want to overwrite it?',
      initial: false,
    });

    if (!overwrite) {
      console.log(chalk.blue('ℹ️  Initialization cancelled.'));
      return;
    }
  }

  // Detect or select stack
  const stack = options.stack || (await detectStack());
  console.log(chalk.green(`✓ Stack detected: ${stack}`));
  console.log();

  // Generate config
  const config = await generateConfig(stack, options.monorepo || false);

  // Show preview
  console.log(chalk.cyan('📄 Preview of .devflow.yml:'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(yaml.stringify(config));
  console.log(chalk.gray('─'.repeat(60)));
  console.log();

  if (options.dryRun) {
    console.log(chalk.blue('ℹ️  Dry run - no files created.'));
    return;
  }

  // Confirm
  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Create .devflow.yml with this configuration?',
    initial: true,
  });

  if (!confirm) {
    console.log(chalk.blue('ℹ️  Initialization cancelled.'));
    return;
  }

  // Create .devflow.yml
  const spinner = ora('Creating .devflow.yml...').start();
  try {
    await fs.writeFile(configPath, yaml.stringify(config), 'utf-8');
    spinner.succeed(chalk.green('✓ Created .devflow.yml'));
  } catch (error) {
    spinner.fail(chalk.red('✗ Failed to create .devflow.yml'));
    throw error;
  }

  // Create .env.example if not exists
  await createEnvExample();

  // Success message
  console.log();
  console.log(chalk.green.bold('✓ Initialization complete!'));
  console.log();
  console.log(chalk.cyan('Next steps:'));
  console.log(chalk.white('  1. Review and customize .devflow.yml'));
  console.log(chalk.white('  2. Run: devflow oauth:register'));
  console.log(chalk.white('  3. Run: devflow oauth:connect'));
  console.log(chalk.white('  4. Check status: devflow oauth:status'));
  console.log();
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectStack(): Promise<string> {
  const cwd = process.cwd();

  // Check for package.json (Node)
  if (await fileExists(path.join(cwd, 'package.json'))) {
    return 'node';
  }

  // Check for composer.json (PHP)
  if (await fileExists(path.join(cwd, 'composer.json'))) {
    return 'php';
  }

  // Check for requirements.txt or pyproject.toml (Python)
  if (
    (await fileExists(path.join(cwd, 'requirements.txt'))) ||
    (await fileExists(path.join(cwd, 'pyproject.toml')))
  ) {
    return 'python';
  }

  // Check for go.mod (Go)
  if (await fileExists(path.join(cwd, 'go.mod'))) {
    return 'go';
  }

  // Check for Cargo.toml (Rust)
  if (await fileExists(path.join(cwd, 'Cargo.toml'))) {
    return 'rust';
  }

  // Prompt user
  const { stack } = await prompts({
    type: 'select',
    name: 'stack',
    message: 'Select your technology stack:',
    choices: [
      { title: 'Node.js', value: 'node' },
      { title: 'PHP', value: 'php' },
      { title: 'Python', value: 'python' },
      { title: 'Go', value: 'go' },
      { title: 'Rust', value: 'rust' },
    ],
  });

  return stack;
}

async function generateConfig(stack: string, monorepo: boolean): Promise<any> {
  const baseConfig = {
    version: '1.0',
    project: {
      name: path.basename(process.cwd()),
      type: monorepo ? 'monorepo' : 'single',
    },
    commands: getCommandsForStack(stack),
    testing: {
      framework: getTestFrameworkForStack(stack),
      coverage: {
        enabled: true,
        threshold: 80,
      },
    },
    guardrails: {
      allow_write_paths: ['src/', 'tests/', 'docs/'],
      max_commits: 10,
      max_file_size_kb: 500,
      max_changes_lines: 1000,
      codeowners: {
        enabled: false,
        paths: [],
      },
    },
    llm_budget: {
      daily_tokens: 100000,
      daily_cost_usd: 5.0,
      rate_limit_per_minute: 10,
    },
  };

  return baseConfig;
}

function getCommandsForStack(stack: string): any {
  const commands: Record<string, any> = {
    node: {
      setup: { run: 'npm install', timeout: 300 },
      build: { run: 'npm run build', timeout: 600 },
      lint: { run: 'npm run lint', timeout: 120 },
      unit: { run: 'npm test', timeout: 300 },
      e2e: { run: 'npm run test:e2e', timeout: 600 },
      fmt: { run: 'npm run format', timeout: 60 },
    },
    php: {
      setup: { run: 'composer install', timeout: 300 },
      build: { run: 'composer dump-autoload', timeout: 120 },
      lint: { run: './vendor/bin/phpcs', timeout: 120 },
      unit: { run: './vendor/bin/phpunit', timeout: 300 },
      fmt: { run: './vendor/bin/phpcbf', timeout: 60 },
    },
    python: {
      setup: { run: 'pip install -r requirements.txt', timeout: 300 },
      lint: { run: 'flake8 .', timeout: 120 },
      unit: { run: 'pytest', timeout: 300 },
      fmt: { run: 'black .', timeout: 60 },
    },
    go: {
      setup: { run: 'go mod download', timeout: 300 },
      build: { run: 'go build ./...', timeout: 600 },
      lint: { run: 'golangci-lint run', timeout: 120 },
      unit: { run: 'go test ./...', timeout: 300 },
      fmt: { run: 'go fmt ./...', timeout: 60 },
    },
    rust: {
      setup: { run: 'cargo fetch', timeout: 300 },
      build: { run: 'cargo build --release', timeout: 1200 },
      lint: { run: 'cargo clippy', timeout: 300 },
      unit: { run: 'cargo test', timeout: 600 },
      fmt: { run: 'cargo fmt', timeout: 60 },
    },
  };

  return commands[stack] || commands.node;
}

function getTestFrameworkForStack(stack: string): string {
  const frameworks: Record<string, string> = {
    node: 'jest',
    php: 'phpunit',
    python: 'pytest',
    go: 'go test',
    rust: 'cargo test',
  };

  return frameworks[stack] || 'unknown';
}

async function createEnvExample(): Promise<void> {
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const exists = await fileExists(envExamplePath);

  if (exists) {
    console.log(chalk.blue('ℹ️  .env.example already exists, skipping.'));
    return;
  }

  const envContent = `# DevFlow Configuration
# Copy this file to .env and fill in your values

# API
DEVFLOW_API_URL=http://localhost:3000

# OAuth (REQUIRED for GitHub/Linear integration)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
OAUTH_ENCRYPTION_KEY=

# GitHub/Linear - Now uses OAuth per-project
# Register via: devflow oauth:register
# Connect via: devflow oauth:connect
GITHUB_REPOSITORY=
LINEAR_WEBHOOK_SECRET=

# Anthropic (optional)
ANTHROPIC_API_KEY=

# OpenAI (optional)
OPENAI_API_KEY=

# Slack (optional)
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
`;

  try {
    await fs.writeFile(envExamplePath, envContent, 'utf-8');
    console.log(chalk.green('✓ Created .env.example'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not create .env.example'));
  }
}
