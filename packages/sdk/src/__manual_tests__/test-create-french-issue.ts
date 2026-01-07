/**
 * Test script to create a French issue for testing refinement title/description reformulation
 */
import { LinearClient } from '@linear/sdk';
import { createOAuthTokenResolver } from '../auth/oauth-token-resolver';

async function createTestIssue() {
  // PROJECT_ID is required
  const projectId = process.env.PROJECT_ID;
  if (!projectId) {
    console.error('❌ PROJECT_ID environment variable is required');
    console.log('\nUsage:');
    console.log('  DATABASE_URL="postgresql://..." PROJECT_ID="your-project-id" npx tsx src/__manual_tests__/test-create-french-issue.ts');
    process.exit(1);
  }

  // Use SDK's token resolver
  const tokenResolver = createOAuthTokenResolver();
  const accessToken = await tokenResolver.resolveToken(projectId, 'LINEAR');
  
  console.log('✅ Token resolved successfully');
  
  // Create Linear client
  const linear = new LinearClient({ apiKey: accessToken });
  
  // Get the team
  const teams = await linear.teams();
  const team = teams.nodes[0];
  console.log('📋 Team:', team.name, team.id);
  
  // Get "To Refinement" state
  const states = await team.states();
  const toRefinementState = states.nodes.find(s => s.name === 'To Refinement');
  
  if (!toRefinementState) {
    console.log('Available states:', states.nodes.map(s => s.name));
    throw new Error('To Refinement state not found');
  }
  
  console.log('🔄 To Refinement state:', toRefinementState.id);
  
  // Create test issue in French with minimal/no description
  const issue = await linear.createIssue({
    teamId: team.id,
    title: 'Ajouter la fonctionnalité de recherche avancée',
    description: 'On veut pouvoir filtrer les résultats par date et par catégorie.',
    stateId: toRefinementState.id,
    priority: 2
  });
  
  const createdIssue = await issue.issue;
  console.log('\n✅ Created issue:', createdIssue?.identifier, createdIssue?.title);
  console.log('🔗 Issue ID:', createdIssue?.id);
  console.log('🌐 URL:', createdIssue?.url);
  console.log('\n⏳ The webhook should trigger the refinement workflow automatically...');
}

createTestIssue().catch(console.error);
