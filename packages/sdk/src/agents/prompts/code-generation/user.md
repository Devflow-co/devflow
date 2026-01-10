Generate production-ready code implementation for the following task:

## Task Information

**Title:** {{taskTitle}}

**Description:**
{{taskDescription}}

**Identifier:** {{taskIdentifier}}

## Technical Specification (Phase 3)

### Architecture Decisions
{{architectureDecisions}}

### Implementation Steps
{{implementationSteps}}

### Testing Strategy
{{testingStrategy}}

### Risks & Mitigations
{{risks}}

### Files to Affect
{{filesAffected}}

## User Story (Phase 2)

**As a** {{userStoryActor}}
**I want** {{userStoryGoal}}
**So that** {{userStoryBenefit}}

### Acceptance Criteria
{{acceptanceCriteria}}

## Project Context

**Primary Language:** {{projectLanguage}}

**Framework:** {{projectFramework}}

**Test Framework:** {{projectTestFramework}}

## Codebase Context (Relevant Snippets)

The following code snippets are from the existing codebase. Use these to understand patterns and conventions:

{{codebaseContext}}

## Files to Modify (Full Contents)

**IMPORTANT:** The following are the COMPLETE, UNTRUNCATED contents of files that need to be modified.
When modifying these files, you MUST:
1. Preserve all existing code that should remain unchanged
2. Add/modify only what is necessary for the implementation
3. Keep the same style, formatting, and conventions
4. Maintain all existing imports, exports, and dependencies

{{fullFilesContext}}

## Your Task

Based on the technical specification above:

1. **GENERATE CODE** - Create the implementation files
   - Follow the implementation steps from the technical plan
   - Create or modify the files listed in "Files to Affect"
   - Match the patterns from the codebase context exactly

2. **COMPLETE IMPLEMENTATION** - No placeholders
   - Generate complete, working code for each file
   - Include all necessary imports
   - Add proper error handling
   - Ensure TypeScript types are correct

3. **PR DOCUMENTATION** - Prepare for review
   - Write a clear commit message (conventional commits format)
   - Create a descriptive PR title
   - Write a PR description with:
     - Summary of changes
     - List of files modified/created
     - How to test the changes
     - Link placeholder for Linear issue (will be added automatically)

## Requirements

- Your code MUST compile without errors
- Your code MUST follow the existing codebase patterns
- Your code MUST address ALL acceptance criteria from the user story
- Your code MUST include proper error handling
- Your code MUST be fully typed (no `any` types unless absolutely necessary)

## Branch Naming

Use this format: `feat/{{branchSuffix}}`

Where `{{branchSuffix}}` is a short, kebab-case description derived from the task title.

Remember: This code will be committed directly to a branch and a draft PR will be created for human review. Quality and correctness are paramount.
