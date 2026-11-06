export interface PromptGuardResult {
  isSafe: boolean;
  detectedPattern?: string;
  sanitizedInput: string;
}

export class PromptGuard {
  private static DANGEROUS_PATTERNS = [
    /---\s*begin\s+system\s*---/i,
    /---\s*end\s+system\s*---/i,
    /<\s*system\s*>/i,
    /<\s*\/\s*system\s*>/i,
    /\[\s*system\s+instruction\s*\]/i,
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
    /bypass\s+(rbac|permissions|security\s+checks)/i,
    /you\s+are\s+now\s+in\s+(developer|unrestricted|god)\s+mode/i,
    /elevate\s+(my|user)\s+role/i,
    /drop\s+table\s+/i,
    /select\s+\*\s+from\s+jarvis_system/i,
  ];

  public static inspectInput(input: string): PromptGuardResult {
    if (!input || typeof input !== 'string') {
      return { isSafe: true, sanitizedInput: '' };
    }

    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        return {
          isSafe: false,
          detectedPattern: pattern.source,
          sanitizedInput: input.replace(pattern, '[REDACTED_INJECTION_ATTEMPT]'),
        };
      }
    }

    // Basic sanitization
    const sanitized = input.trim();
    return { isSafe: true, sanitizedInput: sanitized };
  }

  public static wrapUntrustedContent(content: string, sourceName: string): string {
    // Delimit external untrusted retrieved document chunks so LLM treats as pure data
    return `<<<START_UNTRUSTED_DOCUMENT_CONTENT [Source: ${sourceName}]>>>\n${content}\n<<<END_UNTRUSTED_DOCUMENT_CONTENT>>>`;
  }
}
