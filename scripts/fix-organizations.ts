/**
 * Fix missing organizations for existing users
 * Creates personal organizations and links Test Project to first user
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking for users without organizations...\n');

  // Get all users
  const users = await prisma.user.findMany({
    include: {
      organizations: {
        include: {
          organization: true,
        },
      },
    },
  });

  console.log(`Found ${users.length} users in database\n`);

  // Find users without organizations
  const usersWithoutOrg = users.filter((user) => user.organizations.length === 0);

  if (usersWithoutOrg.length === 0) {
    console.log('✅ All users have organizations!\n');
  } else {
    console.log(`⚠️  Found ${usersWithoutOrg.length} users without organizations:\n`);

    for (const user of usersWithoutOrg) {
      console.log(`👤 Creating organization for: ${user.email} (${user.name || 'no name'})`);

      const orgName = user.name
        ? `${user.name}'s Organization`
        : `${user.email}'s Organization`;
      const orgSlug = `${user.id}-personal`;

      try {
        const org = await prisma.organization.create({
          data: {
            name: orgName,
            slug: orgSlug,
            members: {
              create: {
                userId: user.id,
                role: 'OWNER',
              },
            },
          },
        });

        console.log(`   ✅ Created organization: ${org.name} (${org.id})\n`);
      } catch (error) {
        console.error(`   ❌ Failed to create organization:`, error);
      }
    }
  }

  // Check for projects without organization links
  console.log('\n🔍 Checking for projects without organization links...\n');

  const projects = await prisma.project.findMany({
    include: {
      organizations: {
        include: {
          organization: true,
        },
      },
    },
  });

  console.log(`Found ${projects.length} projects in database\n`);

  const projectsWithoutOrg = projects.filter((project) => project.organizations.length === 0);

  if (projectsWithoutOrg.length === 0) {
    console.log('✅ All projects are linked to organizations!\n');
  } else {
    console.log(`⚠️  Found ${projectsWithoutOrg.length} projects without organization links:\n`);

    // Get first user's organization to link projects
    const firstUser = users[0];
    const firstUserOrg = await prisma.organizationMember.findFirst({
      where: { userId: firstUser.id, role: 'OWNER' },
      include: { organization: true },
    });

    if (!firstUserOrg) {
      console.error('❌ Cannot find organization for first user. Please run this script again.');
      return;
    }

    console.log(`📎 Linking orphaned projects to: ${firstUserOrg.organization.name}\n`);

    for (const project of projectsWithoutOrg) {
      console.log(`🔗 Linking project: ${project.name} (${project.id})`);

      try {
        await prisma.organizationProject.create({
          data: {
            organizationId: firstUserOrg.organizationId,
            projectId: project.id,
          },
        });

        console.log(`   ✅ Linked to organization: ${firstUserOrg.organization.name}\n`);
      } catch (error) {
        console.error(`   ❌ Failed to link project:`, error);
      }
    }
  }

  console.log('\n✅ Migration complete!\n');

  // Show summary
  console.log('📊 Summary:');
  const orgCount = await prisma.organization.count();
  const memberCount = await prisma.organizationMember.count();
  const projectLinkCount = await prisma.organizationProject.count();

  console.log(`   Organizations: ${orgCount}`);
  console.log(`   Organization Members: ${memberCount}`);
  console.log(`   Project-Organization Links: ${projectLinkCount}`);
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
