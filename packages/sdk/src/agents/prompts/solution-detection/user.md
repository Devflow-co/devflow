# Solution Detection Request

Analyze the following validation failure and identify possible solutions.

## Task Information

**Task ID:** {{taskId}}
**Task Title:** {{taskTitle}}
**Retry Attempt:** {{attemptNumber}} of {{maxAttempts}}

## Error Information

**Failed Phase:** {{failedPhase}}
**Exit Code:** {{exitCode}}

### Container Logs
```
{{containerLogs}}
```

### Error Summary
{{errorSummary}}

## Generated Code

### Files That Were Generated
{{generatedFilesSummary}}

### Failing File Content
```{{fileExtension}}
{{failingFileContent}}
```

## Original Context

### Technical Plan
{{technicalPlan}}

### Codebase Patterns
{{codebaseContext}}

---

**Instructions:**
1. Analyze the error output to understand the root cause
2. Identify all valid ways to fix this error
3. If multiple solutions exist with different trade-offs, present them as options
4. If the fix is obvious, indicate single solution
5. Always include a recommendation

Return your analysis in the JSON format specified in the system prompt.
