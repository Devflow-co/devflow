/**
 * Test Linear Document API
 *
 * Verifies that we can:
 * 1. Create a document
 * 2. Read the document
 * 3. Update the document
 * 4. Create an attachment linking document to issue
 * 5. List attachments on an issue
 */

import { LinearClient } from '@linear/sdk';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

// Use an existing issue for testing
const TEST_ISSUE_ID = process.env.TEST_ISSUE_ID || 'd85399b4-0706-4dfd-966e-8116a9324eb1'; // STU-54

if (!LINEAR_API_KEY) {
  console.error('❌ Error: LINEAR_API_KEY environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('🧪 Testing Linear Document API\n');

  const client = new LinearClient({ apiKey: LINEAR_API_KEY });

  try {
    // Step 0: Get issue info
    console.log('📋 Step 0: Getting issue info...');
    const issue = await client.issue(TEST_ISSUE_ID);
    console.log(`   Issue: ${issue.identifier} - ${issue.title}`);
    const project = await issue.project;
    const team = await issue.team;
    console.log(`   Project: ${project?.name || 'None'} (${project?.id || 'N/A'})`);
    console.log(`   Team: ${team?.name || 'None'} (${team?.id || 'N/A'})`);
    console.log();

    // Step 1: Create a document
    // Note: API requires exactly one of: initiativeId, teamId, issueId, projectId
    // We'll try with teamId since project may be null
    console.log('📝 Step 1: Creating a document...');
    const createInput: any = {
      title: `${issue.identifier} - Test Document`,
      content: `# Test Document\n\nThis is a test document created by DevFlow E2E test.\n\n## Content\n\n- Item 1\n- Item 2\n- Item 3\n\n*Created at: ${new Date().toISOString()}*`,
    };

    // Try issueId first (directly link to issue), fallback to teamId
    if (project?.id) {
      createInput.projectId = project.id;
      console.log(`   Using projectId: ${project.id}`);
    } else if (team?.id) {
      // teamId may not be in SDK types but API supports it
      (createInput as any).teamId = team.id;
      console.log(`   Using teamId: ${team.id}`);
    }

    const createResult = await client.createDocument(createInput);

    if (!createResult.success) {
      throw new Error('Failed to create document');
    }

    const doc = await createResult.document;
    console.log(`   ✅ Document created!`);
    console.log(`   ID: ${doc?.id}`);
    console.log(`   URL: ${doc?.url}`);
    console.log(`   Title: ${doc?.title}`);
    console.log();

    // Step 2: Read the document
    console.log('📖 Step 2: Reading the document...');
    const readDoc = await client.document(doc!.id);
    console.log(`   ✅ Document read!`);
    console.log(`   Title: ${readDoc.title}`);
    console.log(`   Content preview: ${readDoc.content?.substring(0, 100)}...`);
    console.log();

    // Step 3: Update the document
    console.log('✏️  Step 3: Updating the document...');
    const updateResult = await client.updateDocument(doc!.id, {
      content: `# Test Document (Updated)\n\nThis document was updated by the E2E test.\n\n## Updated Content\n\n- Updated Item 1\n- Updated Item 2\n\n*Updated at: ${new Date().toISOString()}*`,
    });

    if (!updateResult.success) {
      throw new Error('Failed to update document');
    }

    const updatedDoc = await updateResult.document;
    console.log(`   ✅ Document updated!`);
    console.log(`   New content preview: ${updatedDoc?.content?.substring(0, 100)}...`);
    console.log();

    // Step 4: Create an attachment linking document to issue
    console.log('🔗 Step 4: Creating attachment to link document to issue...');
    const attachResult = await client.createAttachment({
      issueId: TEST_ISSUE_ID,
      title: '📄 Test Document',
      subtitle: 'Created by DevFlow E2E test',
      url: doc!.url,
      metadata: {
        phase: 'test',
        documentId: doc!.id,
        createdAt: new Date().toISOString(),
      },
    });

    if (!attachResult.success) {
      throw new Error('Failed to create attachment');
    }

    const attachment = await attachResult.attachment;
    console.log(`   ✅ Attachment created!`);
    console.log(`   ID: ${attachment?.id}`);
    console.log(`   Title: ${attachment?.title}`);
    console.log();

    // Step 5: List attachments on the issue
    console.log('📎 Step 5: Listing attachments on issue...');
    const issueWithAttachments = await client.issue(TEST_ISSUE_ID);
    const attachments = await issueWithAttachments.attachments();
    console.log(`   ✅ Found ${attachments.nodes.length} attachment(s):`);
    for (const att of attachments.nodes) {
      console.log(`   - ${att.title} (${att.url})`);
      if (att.metadata) {
        console.log(`     Metadata: ${JSON.stringify(att.metadata)}`);
      }
    }
    console.log();

    // Step 6: Clean up - delete the test document
    console.log('🗑️  Step 6: Cleaning up (deleting test document)...');
    const deleteResult = await client.deleteDocument(doc!.id);
    if (deleteResult.success) {
      console.log(`   ✅ Document deleted!`);
    } else {
      console.log(`   ⚠️  Could not delete document (may need manual cleanup)`);
    }

    // Also delete the attachment
    console.log('🗑️  Deleting test attachment...');
    const deleteAttachResult = await client.deleteAttachment(attachment!.id);
    if (deleteAttachResult.success) {
      console.log(`   ✅ Attachment deleted!`);
    } else {
      console.log(`   ⚠️  Could not delete attachment (may need manual cleanup)`);
    }

    console.log('\n✅ All Document API tests passed!');
    console.log('\nSummary:');
    console.log('- ✅ createDocument() works');
    console.log('- ✅ document() read works');
    console.log('- ✅ updateDocument() works');
    console.log('- ✅ attachmentCreate() works');
    console.log('- ✅ issue.attachments() works');
    console.log('- ✅ deleteDocument() works');
    console.log('- ✅ deleteAttachment() works');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

main();
