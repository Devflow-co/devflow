/**
 * Test script to manually trigger DevFlow workflow on a Linear issue
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

import { LinearClient } from '../linear/linear.client';

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;
  const triggerStatus = process.env.LINEAR_TRIGGER_STATUS || 'To Spec';
  const apiUrl = process.env.API_URL || 'http://localhost:3000';

  if (!apiKey) {
    console.error('❌ LINEAR_API_KEY not set');
    process.exit(1);
  }

  console.log('🔍 Searching for issues with status:', triggerStatus, '\n');

  const linearClient = new LinearClient({ apiKey });

  try {
    // Find issues with the trigger status
    const tasks = await linearClient.queryIssuesByStatus(triggerStatus);

    if (tasks.length === 0) {
      console.log(`❌ No issues found with status "${triggerStatus}"`);
      console.log('   Please move an issue to this status in Linear first.\n');
      process.exit(1);
    }

    console.log(`✅ Found ${tasks.length} issue(s) ready for spec generation:\n`);

    tasks.forEach((task, index) => {
      console.log(`${index + 1}. [${task.identifier}] ${task.title}`);
      console.log(`   ID: ${task.id}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Priority: ${task.priority}`);
      console.log(`   URL: ${task.url}`);
      if (task.description) {
        const shortDesc = task.description.substring(0, 100);
        console.log(`   Description: ${shortDesc}${task.description.length > 100 ? '...' : ''}`);
      }
      console.log('');
    });

    // Take the first issue
    const selectedTask = tasks[0];
    console.log(`\n🚀 Triggering workflow for: [${selectedTask.identifier}] ${selectedTask.title}\n`);

    // Trigger the workflow via API
    const response = await fetch(`${apiUrl}/api/v1/workflows/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId: selectedTask.id,
        linearIssueId: selectedTask.id,
        linearIssueIdentifier: selectedTask.identifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to start workflow:', response.status, error);
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Workflow started successfully!\n');
    console.log('📊 Workflow details:');
    console.log(`   Workflow ID: ${result.workflowId || result.id || 'N/A'}`);
    console.log(`   Run ID: ${result.runId || 'N/A'}`);
    console.log('\n📍 You can monitor the workflow at:');
    console.log(`   Temporal UI: http://localhost:8080`);
    console.log(`   Linear issue: ${selectedTask.url}\n`);

    console.log('💡 The workflow will:');
    console.log('   1. Analyze the codebase');
    console.log('   2. Generate technical specifications');
    console.log('   3. Update the Linear issue with the spec');
    console.log('   4. Generate code and tests');
    console.log('   5. Create a Pull Request\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
