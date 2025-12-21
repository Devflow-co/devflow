/**
 * E2E Test: Simulate Linear Comment Webhooks
 *
 * This script simulates the Linear webhooks that would be sent when
 * a PO replies to DevFlow's questions (child comments).
 */

import fetch from 'node-fetch';

const API_URL = process.env.DEVFLOW_API_URL || 'http://localhost:3001/api/v1';
const ISSUE_ID = 'd85399b4-0706-4dfd-966e-8116a9324eb1';

// Map of question comment IDs to their reply comment IDs
const ANSWER_COMMENTS = [
  { parentId: '9e32f94e-4ec0-43d6-83af-8ad04309bc27', answerId: 'a3a1bd0e-6168-4106-9597-f0b245dd76fc', body: 'For wrong email: "Email not found"...' },
  { parentId: '1f083c74-846b-44c6-8115-02d3bce7f3bb', answerId: '17f8f440-75e0-4286-93dd-f51f879a4129', body: 'Rate limiting: 5 attempts per 15 minutes...' },
  { parentId: '57282282-a869-495d-b428-f93aa02b5911', answerId: 'e4ec8310-7525-4b4b-bc9e-7acf934f7926', body: 'Yes, we plan to add 2FA...' },
  { parentId: '61beb135-0903-4991-b2ab-a19652e12744', answerId: '70761fb0-9a1b-458a-a6fb-bd3289b092fa', body: 'JWT tokens should have 1 hour expiration...' },
  { parentId: '8d532f39-9623-4a4c-9358-6a8307f34a6d', answerId: 'c8da2afe-23ef-40a5-8e01-bf27c0935283', body: 'GDPR compliance is required...' },
  { parentId: 'fa60bdf9-8ed3-4a69-aba1-0cc887036d4c', answerId: '0fe75bf9-df0b-48a9-bc2d-a0bd06381cf2', body: 'E2E tests should cover...' },
  { parentId: '6858e5f4-305d-4237-834d-3151a9192b29', answerId: 'b2e396ad-dfda-4dca-8429-d156b9e54926', body: 'Account lockout should be automatic...' },
];

async function simulateWebhook(parentId: string, answerId: string, body: string, index: number) {
  const payload = {
    action: 'create',
    type: 'Comment',
    data: {
      id: answerId,
      body: body,
      issueId: ISSUE_ID,
      issue: { id: ISSUE_ID },
      parent: { id: parentId },
      user: { id: 'test-user', name: 'Product Owner' },
      createdAt: new Date().toISOString(),
    },
    actor: { id: 'test-user', name: 'Product Owner' },
  };

  console.log(`[${index + 1}/7] Simulating webhook for answer ${answerId}...`);
  console.log(`   Parent question: ${parentId}`);

  try {
    const response = await fetch(`${API_URL}/webhooks/linear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log(`   Response: ${response.status}`, JSON.stringify(result, null, 2).substring(0, 200));
    console.log();
  } catch (error) {
    console.error(`   Error:`, error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log('🧪 Simulating Linear Comment Webhooks\n');
  console.log(`API URL: ${API_URL}`);
  console.log(`Issue: ${ISSUE_ID}\n`);

  for (let i = 0; i < ANSWER_COMMENTS.length; i++) {
    const { parentId, answerId, body } = ANSWER_COMMENTS[i];
    await simulateWebhook(parentId, answerId, body, i);
    // Small delay between webhooks
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('✅ All webhooks simulated!');
  console.log('\nCheck the API logs for webhook processing.');
}

main().catch(console.error);
