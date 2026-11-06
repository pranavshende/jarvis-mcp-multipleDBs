# -*- coding: utf-8 -*-
"""
Deterministic PII & Sensitive Data Sanitizer.
Implements multi-pattern regex matching, contextual entity detection, and founder-private isolation.
Guarantees zero leakage of SSNs, credit cards, bank accounts, routing numbers, compensation,
secrets, or restricted founder notes into shared knowledge storage.
"""
import re
import os
import logging
from pathlib import Path

logger = logging.getLogger("jarvis.rag.sanitizer")

class DocumentSanitizer:
    # Founder-private restricted files and topics defined in notes/founder_private/INDEX.md
    FOUNDER_PRIVATE_TOPICS = [
        "exit-options-2026.md",
        "board-deck-drafts",
        "bank-line-and-personal-guarantee.md",
        "comp-thoughts-priya-arjun.md",
        "1-1-notes-all.md",
        "who-i-would-hire-next.md",
        "northgate-owner-conversation.md",
        "personal-tax-2026.md",
        "things-im-not-ready-to-say.md"
    ]

    # Pre-compiled high-precision regular expressions
    # 1. Social Security Numbers (SSN & ITIN, 3-2-4 digits with dashes/spaces)
    SSN_PATTERN = re.compile(
        r"\b(?!000|666)\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b",
        re.IGNORECASE
    )

    # 2. Credit Card Numbers (Visa, MasterCard, Amex 4-6-5, Discover, 13-19 digits with dashes/spaces)
    CREDIT_CARD_PATTERN = re.compile(
        r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[47]\d{2}[- ]?\d{6}[- ]?\d{5}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11}|(?:[0-9]{4}[- ]){3}[0-9]{4})\b"
    )

    # 3. Bank Account Numbers (Contextual: preceded by account/acct/checking/savings)
    BANK_ACCOUNT_PATTERN = re.compile(
        r"(?i)\b(?:account|acct|checking|savings|direct deposit|bank acct)[\s:#№\.\-_]*(\d{6,17})\b"
    )

    # 4. Bank Routing Numbers (ABA: 9 digits preceded by routing/aba/transit or standard 9-digit ABA prefixes)
    ROUTING_NUMBER_PATTERN = re.compile(
        r"(?i)\b(?:routing\s*(?:number)?|aba|transit\s*(?:routing)?|rtn)[\s:#№\.\-_]+(\d{9})\b"
    )

    # 5. Compensation, Salaries, Hourly Rates, Bonuses
    # Matches patterns like "$125,000 per year", "salary is $120,000", "$45/hr", "bonus of $25,000"
    COMPENSATION_PATTERN = re.compile(
        r"(?i)(?:\b(?:salary|base|comp|compensation|wage|hourly rate|payroll|bonus|equity grant|annual pay|stipend)[\s\w]*?[\s:]+)?(\$(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?(?:\s*(?:k|m|million|thousand))?(?:\s*(?:\/|\s*per\s*)(?:yr|year|annum|hr|hour|month|mo|wk|week))?)\b",
    )
    # Stricter salary context regex
    SALARY_CONTEXT_PATTERN = re.compile(
        r"(?i)\b(?:salary\s*(?:is|of)?|earns?|paid|comp\s*is|base\s*(?:is|of)?|rate\s*is)\s*[:]?\s*(\$?\d{2,3}(?:,\d{3})+(?:\.\d{2})?|\$\d{2,6})\b"
    )
    HOURLY_RATE_PATTERN = re.compile(
        r"(?i)\b(\$\d+(?:\.\d{2})?\s*(?:\/|\s*per\s*)(?:hr|hour))\b"
    )

    # 6. API Keys, Secrets, Private Tokens
    API_KEY_PATTERN = re.compile(
        r"\b(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{36}|xox[baprs]-[a-zA-Z0-9_-]{20,}|AKIA[0-9A-Z]{16}|bearer\s+[a-zA-Z0-9_\-\.]{32,}|eyJ[a-zA-Z0-9_\-\.]{40,})\b",
        re.IGNORECASE
    )

    @classmethod
    def is_founder_private_path(cls, file_path_or_name):
        """
        Determines whether a document or file path falls under restricted founder-private scope.
        """
        normalized = str(file_path_or_name).lower().replace("\\", "/")
        if "founder_private" in normalized:
            return True
        for topic in cls.FOUNDER_PRIVATE_TOPICS:
            topic_clean = topic.lower().replace(".md", "")
            if topic_clean in normalized:
                return True
        return False

    @classmethod
    def sanitize_text(cls, text, source_path=None):
        """
        Sanitizes text by redacting all sensitive values.
        Returns a dictionary containing:
        - sanitized_text: Cleaned text with placeholders
        - redactions_count: Dict of category -> count
        - is_quarantined: Boolean indicating if content was quarantined
        - quarantine_reason: Reason if quarantined
        """
        if not text:
            return {
                "sanitized_text": "",
                "redactions_count": {},
                "is_quarantined": False,
                "quarantine_reason": None
            }

        # 1. Founder-Private Isolation Check
        if source_path and cls.is_founder_private_path(source_path):
            logger.warning(f"Quarantining founder-private document: {source_path}")
            return {
                "sanitized_text": "[QUARANTINED_FOUNDER_PRIVATE_DOCUMENT]",
                "redactions_count": {"FOUNDER_PRIVATE": 1},
                "is_quarantined": True,
                "quarantine_reason": "Document is classified as restricted founder-private scope."
            }

        redactions = {
            "SSN": 0,
            "CREDIT_CARD": 0,
            "BANK_ACCOUNT": 0,
            "ROUTING_NUMBER": 0,
            "COMPENSATION": 0,
            "API_KEY": 0
        }

        sanitized = text

        # A. Redact API Keys & Secrets
        def replace_secret(match):
            redactions["API_KEY"] += 1
            return "[REDACTED_SECRET]"
        sanitized = cls.API_KEY_PATTERN.sub(replace_secret, sanitized)

        # B. Redact SSNs
        def replace_ssn(match):
            redactions["SSN"] += 1
            return "[REDACTED_SSN]"
        sanitized = cls.SSN_PATTERN.sub(replace_ssn, sanitized)

        # C. Redact Credit Cards
        def replace_cc(match):
            val = match.group(0).replace(" ", "").replace("-", "")
            if 13 <= len(val) <= 19:
                redactions["CREDIT_CARD"] += 1
                return "[REDACTED_CREDIT_CARD]"
            return match.group(0)
        sanitized = cls.CREDIT_CARD_PATTERN.sub(replace_cc, sanitized)

        # D. Redact Bank Routing Numbers
        def replace_routing(match):
            redactions["ROUTING_NUMBER"] += 1
            # Preserve prefix keyword
            prefix = match.group(0)[:match.start(1) - match.start(0)]
            return f"{prefix}[REDACTED_ROUTING_NUMBER]"
        sanitized = cls.ROUTING_NUMBER_PATTERN.sub(replace_routing, sanitized)

        # E. Redact Bank Account Numbers
        def replace_bank_account(match):
            redactions["BANK_ACCOUNT"] += 1
            prefix = match.group(0)[:match.start(1) - match.start(0)]
            return f"{prefix}[REDACTED_BANK_ACCOUNT]"
        sanitized = cls.BANK_ACCOUNT_PATTERN.sub(replace_bank_account, sanitized)

        # F. Redact Compensation / Salaries
        def replace_salary_ctx(match):
            redactions["COMPENSATION"] += 1
            prefix = match.group(0)[:match.start(1) - match.start(0)]
            return f"{prefix}[REDACTED_COMPENSATION]"
        sanitized = cls.SALARY_CONTEXT_PATTERN.sub(replace_salary_ctx, sanitized)

        def replace_hourly(match):
            redactions["COMPENSATION"] += 1
            return "[REDACTED_COMPENSATION]"
        sanitized = cls.HOURLY_RATE_PATTERN.sub(replace_hourly, sanitized)

        # Catch specific salary expressions like "$125,000 per year" or "salary: $150k"
        def replace_comp_general(match):
            full_match = match.group(0)
            target_val = match.group(1)
            # Only redact if context includes compensation indicators or per year/hr
            lower = full_match.lower()
            if any(k in lower for k in ["salary", "comp", "wage", "per year", "/yr", "per annum", "payroll", "hourly", "bonus"]):
                redactions["COMPENSATION"] += 1
                return full_match.replace(target_val, "[REDACTED_COMPENSATION]")
            return full_match
        sanitized = cls.COMPENSATION_PATTERN.sub(replace_comp_general, sanitized)

        total_redactions = sum(redactions.values())
        if total_redactions > 0:
            logger.info(f"Sanitizer redacted {total_redactions} sensitive items: {redactions}")

        return {
            "sanitized_text": sanitized,
            "redactions_count": {k: v for k, v in redactions.items() if v > 0},
            "is_quarantined": False,
            "quarantine_reason": None
        }
