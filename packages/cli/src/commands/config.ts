/**
 * Config Commands
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
// TODO: Re-enable when SDK is properly built
// import { ProjectAdapter } from '@devflow/sdk';
// import { DEVFLOW_CONFIG_FILE } from '@devflow/common';

const DEVFLOW_CONFIG_FILE = '.devflow.yml';

export const configCommands = {
  async validate() {
    const spinner = ora('Validating configuration...').start();

    try {
      // TODO: Re-enable ProjectAdapter validation when SDK is built
      const configPath = path.join(process.cwd(), DEVFLOW_CONFIG_FILE);
      const content = await fs.readFile(configPath, 'utf-8');

      // Basic validation - check file exists and is not empty
      if (!content || content.trim().length === 0) {
        throw new Error('Configuration file is empty');
      }

      spinner.succeed(chalk.green('✓ Configuration file exists'));
      console.log(chalk.yellow('\n⚠️  Full validation requires SDK package to be built'));
      console.log(chalk.gray('Use "devflow config:show" to view current configuration\n'));
    } catch (error: any) {
      spinner.fail(chalk.red('✗ Configuration is invalid'));
      console.error(error.message);
      process.exit(1);
    }
  },

  async show() {
    const configPath = path.join(process.cwd(), DEVFLOW_CONFIG_FILE);

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      console.log(chalk.bold(`\n📄 ${DEVFLOW_CONFIG_FILE}:\n`));
      console.log(content);
    } catch (error: any) {
      console.error(chalk.red(`Failed to read ${DEVFLOW_CONFIG_FILE}`));
      console.error(error.message);
      process.exit(1);
    }
  },
};

