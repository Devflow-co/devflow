// DEPRECATED: These tests use old token auth. Will be updated to OAuth in Phase 5.
// For now, these tests are disabled.

/**
 * Test script to list Linear issues
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

import { LinearClient } from '@/linear/linear.client';

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error('❌ LINEAR_API_KEY not set');
    process.exit(1);
  }

  console.log('🔍 Connecting to Linear...\n');

  const client = new LinearClient({ apiKey });

  try {
    // List all issues
    console.log('📋 Fetching issues...\n');
    const tasks = await client.queryIssues({ first: 20 });

    if (tasks.length === 0) {
      console.log('No issues found');
      return;
    }

    console.log(`Found ${tasks.length} issues:\n`);

    tasks.forEach((task, index) => {
      console.log(`${index + 1}. [${task.identifier}] ${task.title}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Priority: ${task.priority}`);
      console.log(`   URL: ${task.url}`);
      if (task.description) {
        const shortDesc = task.description.substring(0, 100);
        console.log(`   Description: ${shortDesc}${task.description.length > 100 ? '...' : ''}`);
      }
      console.log('');
    });

    // Show issues ready for spec generation
    const triggerStatus = process.env.LINEAR_TRIGGER_STATUS || 'To Spec';
    const readyIssues = tasks.filter(t => t.status === triggerStatus);

    if (readyIssues.length > 0) {
      console.log(`\n✅ Issues ready for spec generation (status: "${triggerStatus}"):\n`);
      readyIssues.forEach((task) => {
        console.log(`  • [${task.identifier}] ${task.title}`);
        console.log(`    URL: ${task.url}\n`);
      });
    } else {
      console.log(`\n⚠️  No issues with status "${triggerStatus}" found`);
      console.log(`   To test spec generation, create an issue in Linear and set its status to "${triggerStatus}"\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
