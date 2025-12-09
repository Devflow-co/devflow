#!/usr/bin/env node
/**
 * Migrate relative imports to @/* path aliases
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const PACKAGES = ['packages/sdk', 'packages/worker', 'packages/api', 'packages/common'];

function resolveImportPath(fromFile, importPath) {
  // Get directory of the importing file
  const fromDir = path.dirname(fromFile);

  // Resolve the relative import to an absolute path
  const absolutePath = path.resolve(fromDir, importPath);

  // Get the package root (find the src/ directory)
  const srcIndex = fromFile.indexOf('/src/');
  if (srcIndex === -1) return null; // Not in src directory

  const packageRoot = fromFile.substring(0, srcIndex);
  const srcDir = path.join(packageRoot, 'src');

  // Get relative path from src directory
  const relativePath = path.relative(srcDir, absolutePath);

  // Return as @/ import
  return '@/' + relativePath;
}

function migrateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  let changes = 0;

  // Match import statements with relative paths (both ./ and ../)
  const importRegex = /from\s+['"]((\.\.?\/)+[^'"]+)['"]/g;

  modified = content.replace(importRegex, (match, importPath) => {
    // Skip if it's already an absolute import
    if (importPath.startsWith('@/') || importPath.startsWith('@devflow/')) {
      return match;
    }

    const newPath = resolveImportPath(filePath, importPath);
    if (newPath) {
      changes++;
      return `from '${newPath}'`;
    }

    return match;
  });

  if (changes > 0) {
    fs.writeFileSync(filePath, modified, 'utf8');
    console.log(`✓ ${filePath} (${changes} imports updated)`);
    return changes;
  }

  return 0;
}

async function main() {
  console.log('🔄 Migrating relative imports to @/* aliases...\n');

  let totalChanges = 0;
  let totalFiles = 0;

  for (const pkg of PACKAGES) {
    console.log(`\n📦 Processing ${pkg}...`);

    const pattern = path.join(pkg, 'src/**/*.ts');
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**'],
      absolute: true
    });

    for (const file of files) {
      const changes = migrateFile(file);
      if (changes > 0) {
        totalChanges += changes;
        totalFiles++;
      }
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Files updated: ${totalFiles}`);
  console.log(`   Imports migrated: ${totalChanges}`);
}

main().catch(console.error);
