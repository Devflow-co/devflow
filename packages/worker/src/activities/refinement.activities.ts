/**
 * Refinement Activities - Phase 1 of Three-Phase Agile Workflow
 *
 * Generates backlog refinement to clarify business requirements.
 * Focus: Business context, objectives, questions for PO, complexity estimation
 */

import { createLogger } from '@devflow/common';
import type { RefinementOutput, AgentImage } from '@devflow/common';
import { createCodeAgentDriver, loadPrompts } from '@devflow/sdk';
import { detectTaskType } from './helpers/task-type-detector';
import {
  extractExternalContext,
  formatExternalContextAsMarkdown,
  hasAnyLink,
  type ExternalContextLinks,
} from './context-extraction.activities';

const logger = createLogger('RefinementActivities');

export interface GenerateRefinementInput {
  task: {
    title: string;
    description: string;
    priority: string;
    labels?: string[];
  };
  projectId: string;
  /** External links to Figma, Sentry, GitHub Issues */
  externalLinks?: ExternalContextLinks;
  /** Previous PO answers (from re-run after questions were answered) */
  poAnswers?: Array<{ question: string; answer: string }>;
  /** RAG context from codebase analysis (top chunks) */
  ragContext?: {
    chunks: Array<{
      filePath: string;
      content: string;
      score: number;
      language: string;
    }>;
    retrievalTimeMs: number;
    totalChunks: number;
  };
  /** Documentation context (project structure, dependencies, conventions) */
  documentationContext?: {
    projectStructure: {
      framework?: string;
      language: string;
      packageManager?: string;
      directories: string[];
      mainPaths: {
        src?: string;
        tests?: string;
        docs?: string;
        config?: string;
      };
    };
    dependencies: {
      production: Record<string, string>;
      dev: Record<string, string>;
      mainLibraries: string[];
    };
    documentation: {
      readme?: string;
      conventions: string[];
      patterns: string[];
    };
    relevantDocs: Array<{
      filePath: string;
      content: string;
      score: number;
    }>;
  };
}

export interface GenerateRefinementOutput {
  refinement: RefinementOutput;
  /** Extracted external context (Figma, Sentry, GitHub Issue) - to be saved as documents */
  externalContext?: {
    figma?: import('@devflow/sdk').FigmaDesignContext;
    sentry?: import('@devflow/sdk').SentryIssueContext;
    githubIssue?: import('@devflow/sdk').GitHubIssueContext;
  };
}

/**
 * Generate refinement for a task using AI
 */
export async function generateRefinement(
  input: GenerateRefinementInput
): Promise<GenerateRefinementOutput> {
  logger.info('Generating refinement', {
    taskTitle: input.task.title,
    projectId: input.projectId,
    hasExternalLinks: !!input.externalLinks && hasAnyLink(input.externalLinks),
    hasPOAnswers: !!input.poAnswers && input.poAnswers.length > 0,
    poAnswersCount: input.poAnswers?.length || 0,
  });

  try {
    // Step 1: Detect task type
    const taskType = detectTaskType(input.task);
    logger.info('Task type detected', { taskType });

    // Step 1.5: Extract external context if links provided
    let externalContextMarkdown = '';
    let figmaImages: AgentImage[] = [];
    let extractedExternalContext: GenerateRefinementOutput['externalContext'];

    if (input.externalLinks && hasAnyLink(input.externalLinks)) {
      logger.info('Extracting external context', { links: input.externalLinks });

      const { context, errors } = await extractExternalContext({
        projectId: input.projectId,
        links: input.externalLinks,
      });

      if (errors.length > 0) {
        logger.warn('Some external context extractions failed', { errors });
      }

      // Store the extracted context for returning later
      extractedExternalContext = context;

      externalContextMarkdown = formatExternalContextAsMarkdown(context);

      // Collect Figma images for vision (if available)
      if (context.figma?.screenshots) {
        figmaImages = context.figma.screenshots
          .filter((s) => s.imageBase64)
          .slice(0, 3) // Limit to 3 images
          .map((s) => ({
            type: 'base64' as const,
            mediaType: 'image/png' as const,
            data: s.imageBase64!,
          }));
      }

      logger.info('External context extracted', {
        hasContext: !!externalContextMarkdown,
        figmaImagesCount: figmaImages.length,
      });
    }

    // Step 1.6: Format PO answers if available
    let poAnswersContext = '';
    if (input.poAnswers && input.poAnswers.length > 0) {
      poAnswersContext = `

---

## 📋 Réponses du Product Owner

Le Product Owner a répondu aux questions précédentes. **Vous DEVEZ intégrer ces réponses dans votre analyse.**

`;
      for (const qa of input.poAnswers) {
        poAnswersContext += `### Question\n> ${qa.question}\n\n`;
        poAnswersContext += `### Réponse du PO\n${qa.answer}\n\n---\n\n`;
      }

      poAnswersContext += `
**⚠️ INSTRUCTIONS IMPORTANTES:**
1. **Intégrez** les réponses ci-dessus dans votre analyse du Business Context et des Objectives
2. **NE RÉPÉTEZ PAS** les questions déjà répondues dans \`questionsForPO\`
3. **Mettez à jour** le scope et les critères d'acceptation en fonction des clarifications reçues
4. Vous pouvez poser de **NOUVELLES questions** uniquement si de nouvelles ambiguïtés apparaissent
5. Si toutes les ambiguïtés sont levées, retournez \`questionsForPO: []\` (tableau vide)

`;
      logger.info('PO answers included in context', { count: input.poAnswers.length });
    }

    // Step 1.7: Format Documentation Context (project structure, dependencies, conventions)
    let documentationContextMarkdown = '';
    if (input.documentationContext) {
      const { projectStructure, dependencies, documentation, relevantDocs } = input.documentationContext;

      documentationContextMarkdown = `

---

## 🏗️ Contexte Projet

`;

      // Project structure
      if (projectStructure.framework) {
        documentationContextMarkdown += `**Framework:** ${projectStructure.framework}\n`;
      }
      documentationContextMarkdown += `**Langage:** ${projectStructure.language}\n`;
      if (projectStructure.packageManager) {
        documentationContextMarkdown += `**Package Manager:** ${projectStructure.packageManager}\n`;
      }
      documentationContextMarkdown += '\n';

      // Main libraries
      if (dependencies.mainLibraries.length > 0) {
        documentationContextMarkdown += `**Librairies principales:** ${dependencies.mainLibraries.join(', ')}\n\n`;
      }

      // Conventions
      if (documentation.conventions.length > 0) {
        documentationContextMarkdown += '### Conventions du projet\n\n';
        documentation.conventions.forEach((conv) => {
          documentationContextMarkdown += `- ${conv}\n`;
        });
        documentationContextMarkdown += '\n';
      }

      // Patterns
      if (documentation.patterns.length > 0) {
        documentationContextMarkdown += '### Patterns architecturaux\n\n';
        documentation.patterns.forEach((pattern) => {
          documentationContextMarkdown += `- ${pattern}\n`;
        });
        documentationContextMarkdown += '\n';
      }

      // Relevant docs from RAG
      if (relevantDocs && relevantDocs.length > 0) {
        documentationContextMarkdown += '### Documentation pertinente\n\n';
        relevantDocs.slice(0, 3).forEach((doc, i) => {
          const excerpt = doc.content.length > 300 ? doc.content.substring(0, 300) + '...' : doc.content;
          documentationContextMarkdown += `**${i + 1}. \`${doc.filePath}\`** (score: ${(doc.score * 100).toFixed(0)}%)\n`;
          documentationContextMarkdown += `> ${excerpt.split('\n').join('\n> ')}\n\n`;
        });
      }

      documentationContextMarkdown += '> Utilisez ce contexte pour proposer une solution cohérente avec l\'architecture et les conventions du projet.\n\n';

      logger.info('Documentation context included', {
        framework: projectStructure.framework,
        language: projectStructure.language,
        conventions: documentation.conventions.length,
        patterns: documentation.patterns.length,
      });
    }

    // Step 1.8: Format RAG context (file names only - NOT full code)
    // Full code is stored in Codebase Context document for Phases 2 & 3
    let codebaseFilesMarkdown = '';
    if (input.ragContext?.chunks && input.ragContext.chunks.length > 0) {
      const uniqueFiles = [...new Set(input.ragContext.chunks.map((c) => c.filePath))];

      codebaseFilesMarkdown = `

---

## 📂 Fichiers potentiellement concernés

L'analyse sémantique a identifié ${uniqueFiles.length} fichiers pertinents pour cette tâche:

${uniqueFiles.map((f) => `- \`${f}\``).join('\n')}

> Le code complet est disponible dans le document "Codebase Context" pour les phases suivantes.

`;
      logger.info('Codebase file names included', { filesCount: uniqueFiles.length });
    }

    // Step 2: Load prompts from markdown files
    const prompts = await loadPrompts('refinement', {
      taskTitle: input.task.title,
      taskDescription: input.task.description || 'No description provided',
      taskPriority: input.task.priority,
      externalContext: externalContextMarkdown + poAnswersContext + documentationContextMarkdown + codebaseFilesMarkdown,
    });

    // Step 3: Generate refinement with AI (single model - council only for Phase 3)
    logger.info('Generating refinement with single model');

    const agent = createCodeAgentDriver({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
    });

    const response = await agent.generate({
      ...prompts,
      images: figmaImages.length > 0 ? figmaImages : undefined,
    });
    const refinement = parseRefinementResponse(response.content);

    logger.info('Refinement generated successfully', {
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      hasImages: figmaImages.length > 0,
    });

    return {
      refinement: {
        ...refinement,
        taskType,
      },
      externalContext: extractedExternalContext,
    };
  } catch (error) {
    logger.error('Failed to generate refinement', error);
    throw error;
  }
}

/**
 * Parse JSON response from AI into RefinementOutput (without taskType)
 */
function parseRefinementResponse(
  content: string
): Omit<RefinementOutput, 'taskType'> {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonString);

    return {
      suggestedTitle: parsed.suggestedTitle || '',
      reformulatedDescription: parsed.reformulatedDescription || '',
      businessContext: parsed.businessContext || '',
      objectives: parsed.objectives || [],
      questionsForPO: parsed.questionsForPO,
      suggestedSplit: parsed.suggestedSplit,
      preliminaryAcceptanceCriteria:
        parsed.preliminaryAcceptanceCriteria || [],
      complexityEstimate: parsed.complexityEstimate || 'M',
    };
  } catch (error) {
    logger.error('Failed to parse refinement response', error as Error, { content });
    throw new Error(
      `Failed to parse refinement JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

