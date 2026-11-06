export interface PromptGuardResult {
  isSafe: boolean;
  detectedPattern?: string;
  sanitizedInput: string;
  attackCategory?: string;
}

export class PromptGuard {
  private static DANGEROUS_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
    // 1. Direct Prompt Injections & Jailbreaks
    { pattern: /ignore\s+(all\s+)?(previous|prior)\s+(instructions|rules|policies|commands)/i, category: 'INSTRUCTION_OVERRIDE' },
    { pattern: /disregard\s+(all\s+)?(previous|prior)\s+(instructions|rules|policies|commands)/i, category: 'INSTRUCTION_OVERRIDE' },
    { pattern: /you\s+are\s+now\s+in\s+(developer|unrestricted|god|superadmin|dan)\s+mode/i, category: 'JAILBREAK_ATTEMPT' },
    { pattern: /superadmin\s+mode/i, category: 'JAILBREAK_ATTEMPT' },
    { pattern: /print\s+(the\s+)?(database\s+credentials|api\s+(master\s+)?token)/i, category: 'CREDENTIAL_EXFILTRATION' },
    { pattern: /dump\s+(all\s+)?(active\s+)?api\s+(keys|tokens)/i, category: 'CREDENTIAL_EXFILTRATION' },
    { pattern: /elevate\s+(my|user)\s+role/i, category: 'PRIVILEGE_ESCALATION' },
    { pattern: /bypass\s+(rbac|permissions|security\s+checks)/i, category: 'PRIVILEGE_ESCALATION' },

    // 2. Delimiter & Boundary Evasions
    { pattern: /(begin\s+system|end\s+system|end\s+of\s+query)/i, category: 'DELIMITER_EVASION' },
    { pattern: /---\s*begin\s+system/i, category: 'DELIMITER_EVASION' },
    { pattern: /---\s*end\s+of\s+query/i, category: 'DELIMITER_EVASION' },
    { pattern: /---\s*end\s+system/i, category: 'DELIMITER_EVASION' },
    { pattern: /<\s*system\s*>/i, category: 'DELIMITER_EVASION' },
    { pattern: /<\s*\/\s*system\s*>/i, category: 'DELIMITER_EVASION' },
    { pattern: /\[\s*(system|admin)\s+instruction\s*\]/i, category: 'DELIMITER_EVASION' },

    // 3. Raw SQL Injection & Mutation Attempts
    { pattern: /drop\s+table\s+/i, category: 'RAW_SQL_MUTATION' },
    { pattern: /update\s+(dim_|fct_|analytics\.|jarvis_)/i, category: 'RAW_SQL_MUTATION' },
    { pattern: /delete\s+from\s+/i, category: 'RAW_SQL_MUTATION' },
    { pattern: /insert\s+into\s+/i, category: 'RAW_SQL_MUTATION' },
    { pattern: /select\s+\*\s+from\s+jarvis_system/i, category: 'RAW_SQL_MUTATION' },
    { pattern: /select\s+.*bank_routing_number/i, category: 'FINANCIAL_EXFILTRATION' },

    // 4. Founder Private Directory Access
    { pattern: /founder_private/i, category: 'FOUNDER_PRIVATE_VIOLATION' },
    { pattern: /exit-options-2026/i, category: 'FOUNDER_PRIVATE_VIOLATION' },
    { pattern: /personal-tax-2026/i, category: 'FOUNDER_PRIVATE_VIOLATION' },
    { pattern: /bank-line-and-personal-guarantee/i, category: 'FOUNDER_PRIVATE_VIOLATION' },
    { pattern: /comp-thoughts-priya-arjun/i, category: 'COMPENSATION_EXFILTRATION' },
  ];

  public static inspectInput(input: string): PromptGuardResult {
    if (!input || typeof input !== 'string') {
      return { isSafe: true, sanitizedInput: '' };
    }

    for (const rule of this.DANGEROUS_PATTERNS) {
      if (rule.pattern.test(input)) {
        return {
          isSafe: false,
          detectedPattern: rule.pattern.source,
          attackCategory: rule.category,
          sanitizedInput: input.replace(rule.pattern, '[REDACTED_SECURITY_ATTACK]'),
        };
      }
    }

    // Check for Base64 encoded payload signatures
    if (this.detectSuspiciousEncoding(input)) {
      return {
        isSafe: false,
        detectedPattern: 'BASE64_OBFUSCATION_SIGNATURE',
        attackCategory: 'ENCODED_PAYLOAD_ATTACK',
        sanitizedInput: '[REDACTED_ENCODED_PAYLOAD]',
      };
    }

    const sanitized = input.trim();
    return { isSafe: true, sanitizedInput: sanitized };
  }

  public static wrapUntrustedContent(content: string, sourceName: string): string {
    // Delimit external untrusted retrieved document chunks so LLM treats them as pure data
    return `<<<START_UNTRUSTED_DOCUMENT_CONTENT [Source: ${sourceName}]>>>\n${content}\n<<<END_UNTRUSTED_DOCUMENT_CONTENT>>>`;
  }

  private static detectSuspiciousEncoding(input: string): boolean {
    const base64Regex = /(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
    const matches = input.match(base64Regex);
    if (!matches) return false;

    for (const match of matches) {
      try {
        const decoded = Buffer.from(match, 'base64').toString('utf-8');
        if (/ignore\s+all|superadmin|system\s+instruction|drop\s+table/i.test(decoded)) {
          return true;
        }
      } catch {}
    }
    return false;
  }
}
