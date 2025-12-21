/**
 * E2E Test: Answer PO Questions
 *
 * This script simulates a Product Owner answering questions posted by DevFlow.
 * It creates reply comments to each question comment in Linear.
 */

import { LinearClient } from '@linear/sdk';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const ISSUE_ID = process.env.ISSUE_ID;

if (!LINEAR_API_KEY) {
  console.error('❌ Error: LINEAR_API_KEY environment variable is required');
  process.exit(1);
}

if (!ISSUE_ID) {
  console.error('❌ Error: ISSUE_ID environment variable is required');
  process.exit(1);
}

// Question comment IDs from STU-54
const QUESTION_COMMENTS = [
  { id: '9e32f94e-4ec0-43d6-83af-8ad04309bc27', answer: 'For wrong email: "Email not found". For wrong password: "Invalid password". For account locked: "Account locked. Try again in 15 minutes."' },
  { id: '1f083c74-846b-44c6-8115-02d3bce7f3bb', answer: 'Rate limiting: 5 attempts per 15 minutes. Lockout duration: 15 minutes initially, doubling on repeated lockouts.' },
  { id: '57282282-a869-495d-b428-f93aa02b5911', answer: 'Yes, we plan to add 2FA in phase 2 and SSO (Google, Microsoft) in phase 3. Design should be extensible for this.' },
  { id: '61beb135-0903-4991-b2ab-a19652e12744', answer: 'JWT tokens should have 1 hour expiration. Refresh tokens should last 7 days. These values should be configurable via environment variables.' },
  { id: '8d532f39-9623-4a4c-9358-6a8307f34a6d', answer: 'GDPR compliance is required. We need to log authentication attempts without storing passwords. User consent for cookies must be obtained.' },
  { id: 'fa60bdf9-8ed3-4a69-aba1-0cc887036d4c', answer: 'E2E tests should cover: successful login, failed login (wrong password), account lockout after max attempts, token refresh, logout, and session timeout.' },
  { id: '6858e5f4-305d-4237-834d-3151a9192b29', answer: 'Account lockout should be automatic with time-based unlock (15 minutes). Admin override should also be available for emergency unlocks.' },
];

async function main() {
  console.log('🧪 E2E Test: Answering PO Questions\n');
  console.log(`Issue ID: ${ISSUE_ID}`);
  console.log(`Questions to answer: ${QUESTION_COMMENTS.length}\n`);

  const client = new LinearClient({ apiKey: LINEAR_API_KEY });

  for (let i = 0; i < QUESTION_COMMENTS.length; i++) {
    const { id: parentCommentId, answer } = QUESTION_COMMENTS[i];

    console.log(`[${i + 1}/${QUESTION_COMMENTS.length}] Answering question...`);
    console.log(`   Parent comment: ${parentCommentId}`);
    console.log(`   Answer: ${answer.substring(0, 50)}...`);

    try {
      // Create a reply comment (child of the question comment)
      const result = await client.createComment({
        issueId: ISSUE_ID,
        body: answer,
        parentId: parentCommentId,
      });

      if (result.success) {
        const comment = await result.comment;
        console.log(`   ✅ Reply created: ${comment?.id}\n`);
      } else {
        console.log(`   ❌ Failed to create reply\n`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('\n✅ All questions answered!');
  console.log('\nNow check:');
  console.log('1. API logs: docker-compose logs -f api');
  console.log('2. Worker logs: docker-compose logs -f worker');
  console.log('3. Linear issue status should change from "Refinement In Progress"');
}

main().catch(console.error);
