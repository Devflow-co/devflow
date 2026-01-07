/**
 * Test script to extract Figma node context
 *
 * URL: https://www.figma.com/design/TfJw2zsGB11mbievCt5c3n/Crown--Core-Functionality-?node-id=12252-33902&m=dev
 * File Key: TfJw2zsGB11mbievCt5c3n
 * Node ID: 12252-33902
 */

import { PrismaClient } from '@devflow/common/prisma';
import { createFigmaClient } from '../figma/figma.client';
import { TokenService } from '../auth/token.service';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function testFigmaNodeContext() {
  // PROJECT_ID is required
  const projectId = process.env.PROJECT_ID;
  if (!projectId) {
    console.error('❌ PROJECT_ID environment variable is required');
    console.log('\nUsage:');
    console.log('  DATABASE_URL="postgresql://..." PROJECT_ID="your-project-id" FIGMA_FILE_KEY="xxx" FIGMA_NODE_ID="xxx" npx tsx src/__manual_tests__/test-figma-node-context.ts');
    process.exit(1);
  }
  const fileKey = process.env.FIGMA_FILE_KEY || 'TfJw2zsGB11mbievCt5c3n';
  const nodeId = process.env.FIGMA_NODE_ID || '12252-33902';

  console.log('\n🎨 Figma Node Context Extractor\n');
  console.log(`Project: ${projectId}`);
  console.log(`File: ${fileKey}`);
  console.log(`Node: ${nodeId}\n`);

  try {
    // 1. Get OAuth connection from database
    console.log('📡 Fetching Figma OAuth connection...');
    const connection = await prisma.oAuthConnection.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'FIGMA',
        },
      },
    });

    if (!connection) {
      throw new Error('No Figma OAuth connection found for this project');
    }

    console.log(`✅ Found connection for ${connection.providerEmail}\n`);

    // 2. Decrypt access token
    console.log('🔓 Decrypting access token...');
    const tokenService = new TokenService();
    const accessToken = await tokenService.getAccessToken(projectId, 'FIGMA');
    console.log(`✅ Access token ready\n`);

    // 3. Create Figma client
    console.log('🚀 Initializing Figma client...');
    const figmaClient = createFigmaClient(accessToken);
    console.log(`✅ Client initialized\n`);

    // 4. Extract design context (metadata + comments + screenshot)
    console.log('📥 Extracting design context...');
    const context = await figmaClient.getDesignContext(fileKey, nodeId);

    console.log('\n📊 Design Context Extracted:\n');
    console.log('File Information:');
    console.log(`  - Name: ${context.fileName}`);
    console.log(`  - Last Modified: ${context.lastModified}`);
    console.log(`  - Thumbnail: ${context.thumbnailUrl ? 'Available' : 'N/A'}`);

    console.log('\nComments:');
    console.log(`  - Total unresolved: ${context.comments.length}`);
    context.comments.slice(0, 3).forEach((comment: any, i: number) => {
      console.log(`  ${i + 1}. ${comment.user.handle}: ${comment.message.substring(0, 60)}...`);
    });

    console.log('\nScreenshots:');
    if (context.screenshots.length > 0) {
      context.screenshots.forEach((screenshot: any) => {
        console.log(`  - Node: ${screenshot.nodeName || screenshot.nodeId}`);
        console.log(`  - Image URL: ${screenshot.imageUrl}`);
        console.log(`  - Base64 size: ${screenshot.imageBase64.length} chars`);
      });
    } else {
      console.log('  - No screenshots captured');
    }

    // 5. Get detailed node information
    console.log('\n📄 Fetching detailed node data...');
    const fileData = await figmaClient.getFileMetadata(fileKey);

    // Find the specific node in the file tree
    function findNodeById(nodes: any[], targetId: string): any {
      for (const node of nodes) {
        if (node.id === targetId) {
          return node;
        }
        if (node.children) {
          const found = findNodeById(node.children, targetId);
          if (found) return found;
        }
      }
      return null;
    }

    if (fileData.document?.children) {
      const targetNode = findNodeById(fileData.document.children, nodeId);
      if (targetNode) {
        console.log('\n🎯 Node Details:');
        console.log(`  - Name: ${targetNode.name}`);
        console.log(`  - Type: ${targetNode.type}`);
        console.log(`  - Visible: ${targetNode.visible !== false ? 'Yes' : 'No'}`);
        if (targetNode.characters) {
          console.log(`  - Text: "${targetNode.characters}"`);
        }
        if (targetNode.children) {
          console.log(`  - Children: ${targetNode.children.length}`);
        }
      } else {
        console.log('\n⚠️  Node not found in file tree (might be nested deep)');
      }
    }

    console.log('\n✅ Context extraction completed successfully!\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testFigmaNodeContext().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
