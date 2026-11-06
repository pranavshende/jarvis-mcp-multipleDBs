# -*- coding: utf-8 -*-
"""
Jarvis v1 — Phase 3 Mandatory Security Test Suite.
Verifies 100 distinct sensitive-data test cases covering:
1. Social Security Numbers (SSNs with various formatting)
2. Credit Card numbers (Visa, MC, Amex, Discover with dashes/spaces)
3. Bank Account numbers (contextual checking, savings, direct deposit)
4. Bank Routing numbers (9-digit ABA with prefixes)
5. Employee Compensation & Payroll figures (salaries, hourly wages, bonuses)
6. API Keys, Tokens & Secrets (OpenAI, GitHub, Slack, AWS, JWT)
7. Founder-Private restricted topics isolation

CRITICAL ACCEPTANCE CRITERION: Zero sensitive-value leaks across all 100 test cases.
"""
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.rag.sanitizer import DocumentSanitizer

class TestDocumentSanitizer100Cases(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sanitizer = DocumentSanitizer()

    def test_100_synthetic_sensitive_cases(self):
        # Generate 100 diverse, realistic test cases with known sensitive needles
        test_cases = [
            # 1-15: Social Security Numbers
            ("Employee tax ID is 012-34-5678 on W-2 form.", "012-34-5678", "SSN"),
            ("SSN: 987 65 4321 submitted for contractor onboarding.", "987 65 4321", "SSN"),
            ("Verification code for member SSN: 123-45-6789.", "123-45-6789", "SSN"),
            ("Social Security Number 456-78-1234 recorded.", "456-78-1234", "SSN"),
            ("Member TIN / SSN 800-12-3456 verified by compliance.", "800-12-3456", "SSN"),
            ("SSN 234-56-7890 belongs to warehouse staff member.", "234-56-7890", "SSN"),
            ("Payroll tax file lists 345-67-8901 for tax withholding.", "345-67-8901", "SSN"),
            ("Contractor SSN 456 78 9012 entered in portal.", "456 78 9012", "SSN"),
            ("Seller SSN: 567-89-0123 for 1099-K reporting.", "567-89-0123", "SSN"),
            ("Identity doc: SSN 678-90-1234 matched state ID.", "678-90-1234", "SSN"),
            ("Background check SSN: 789-01-2345 cleared.", "789-01-2345", "SSN"),
            ("Benefits form SSN 890-12-3456 received.", "890-12-3456", "SSN"),
            ("Form W-9 lists 901-23-4567 as tax ID.", "901-23-4567", "SSN"),
            ("SSN: 012 34 5678 for 401k enrollment.", "012 34 5678", "SSN"),
            ("Staff SSN 123-45-6780 on file.", "123-45-6780", "SSN"),

            # 16-30: Credit Card Numbers
            ("Charged Visa 4111-1111-1111-1111 for sample box order.", "4111-1111-1111-1111", "CREDIT_CARD"),
            ("Corporate card 4000 1234 5678 9010 used for supplies.", "4000 1234 5678 9010", "CREDIT_CARD"),
            ("MasterCard 5500-0000-0000-0004 charged $250.00.", "5500-0000-0000-0004", "CREDIT_CARD"),
            ("AMEX card 3782-822463-10005 billed for shipping.", "3782-822463-10005", "CREDIT_CARD"),
            ("Card on file: 5105105105105100 expired 11/28.", "5105105105105100", "CREDIT_CARD"),
            ("Discover card 6011-0000-0000-0000 payment declined.", "6011-0000-0000-0000", "CREDIT_CARD"),
            ("Billing card: 4242-4242-4242-4242 processed.", "4242-4242-4242-4242", "CREDIT_CARD"),
            ("Wholesale partner CC: 5424-0000-0000-0001 authorized.", "5424-0000-0000-0001", "CREDIT_CARD"),
            ("Card 3400-000000-00009 charged for express freight.", "3400-000000-00009", "CREDIT_CARD"),
            ("Refund issued to card 4123-4567-8901-2345.", "4123-4567-8901-2345", "CREDIT_CARD"),
            ("Updated CC 5200 8282 1092 3847 on Stripe.", "5200 8282 1092 3847", "CREDIT_CARD"),
            ("Payment card 4916-1234-5678-9012 validated.", "4916-1234-5678-9012", "CREDIT_CARD"),
            ("Debit card 4024-0071-8293-1928 used at dock.", "4024-0071-8293-1928", "CREDIT_CARD"),
            ("Card number 5555-5555-5555-4444 on partner invoice.", "5555-5555-5555-4444", "CREDIT_CARD"),
            ("Expedited fee paid on card 6500-1234-5678-9012.", "6500-1234-5678-9012", "CREDIT_CARD"),

            # 31-45: Bank Account Numbers
            ("Direct deposit checking account: 9876543210 for seller.", "9876543210", "BANK_ACCOUNT"),
            ("ACH destination bank acct # 123456789012 setup.", "123456789012", "BANK_ACCOUNT"),
            ("Payout account: 5544332211 verified with micro-deposits.", "5544332211", "BANK_ACCOUNT"),
            ("Seller bank account 8877665544 linked to member profile.", "8877665544", "BANK_ACCOUNT"),
            ("Checking account 1029384756 active for disbursements.", "1029384756", "BANK_ACCOUNT"),
            ("Savings account: 9988776655 on NACHA file.", "9988776655", "BANK_ACCOUNT"),
            ("Direct deposit account 4433221100 registered.", "4433221100", "BANK_ACCOUNT"),
            ("Bank acct 7766554433 rejected with code R01.", "7766554433", "BANK_ACCOUNT"),
            ("Target checking acct: 6655443322 for member payout.", "6655443322", "BANK_ACCOUNT"),
            ("Member account: 3344556677 for weekly settlement.", "3344556677", "BANK_ACCOUNT"),
            ("Deposit to bank account # 9182736450 completed.", "9182736450", "BANK_ACCOUNT"),
            ("Wholesale account 1122334455 wire instruction.", "1122334455", "BANK_ACCOUNT"),
            ("Seller checking account: 8273645192 confirmed.", "8273645192", "BANK_ACCOUNT"),
            ("Bank account 4829103948 active for payouts.", "4829103948", "BANK_ACCOUNT"),
            ("Direct deposit account: 5748392019 verified.", "5748392019", "BANK_ACCOUNT"),

            # 46-60: Bank Routing Numbers (ABA)
            ("Chase bank routing: 021000021 on payout batch.", "021000021", "ROUTING_NUMBER"),
            ("Fedwire routing number 121000358 confirmed.", "121000358", "ROUTING_NUMBER"),
            ("NACHA batch ABA: 071000013 for Chicago clearing.", "071000013", "ROUTING_NUMBER"),
            ("Bank routing: 111000025 for Texas regional branch.", "111000025", "ROUTING_NUMBER"),
            ("Routing number: 091000019 for Minneapolis hub.", "091000019", "ROUTING_NUMBER"),
            ("ABA routing 043000096 for Cleveland Fed district.", "043000096", "ROUTING_NUMBER"),
            ("Transit routing: 081000032 recorded on member file.", "081000032", "ROUTING_NUMBER"),
            ("Routing: 061000104 on partner wire slip.", "061000104", "ROUTING_NUMBER"),
            ("NACHA RTN: 051000033 validated.", "051000033", "ROUTING_NUMBER"),
            ("Member routing number: 031000053 on check scan.", "031000053", "ROUTING_NUMBER"),
            ("Bank ABA: 011000138 for Boston clearing.", "011000138", "ROUTING_NUMBER"),
            ("Routing: 101000019 for Kansas City branch.", "101000019", "ROUTING_NUMBER"),
            ("ABA routing: 122000496 for California seller.", "122000496", "ROUTING_NUMBER"),
            ("Transit routing number: 026009593 on form.", "026009593", "ROUTING_NUMBER"),
            ("Wire routing: 062000019 confirmed with depository.", "062000019", "ROUTING_NUMBER"),

            # 61-75: Employee Compensation & Payroll Figures
            ("Staff base salary is $125,000 per year.", "$125,000", "COMPENSATION"),
            ("Warehouse lead earns $32.50/hr on night shift.", "$32.50", "COMPENSATION"),
            ("Annual compensation of $145,000 approved by HR.", "$145,000", "COMPENSATION"),
            ("Executive salary: $210,000 with annual bonus.", "$210,000", "COMPENSATION"),
            ("Employee hourly rate: $28.00 per hour for inspection staff.", "$28.00", "COMPENSATION"),
            ("Priya base salary is $165,000/yr.", "$165,000", "COMPENSATION"),
            ("Kenji comp is $155,000 per year.", "$155,000", "COMPENSATION"),
            ("Quarterly performance bonus of $15,000 awarded.", "$15,000", "COMPENSATION"),
            ("Annual base: $135,000 for senior engineer.", "$135,000", "COMPENSATION"),
            ("Receiving dock wage is $24/hr starting pay.", "$24", "COMPENSATION"),
            ("Contractor rate is $85/hr for cloud architecture.", "$85", "COMPENSATION"),
            ("Payroll summary lists salary $110,000 for operations lead.", "$110,000", "COMPENSATION"),
            ("Employee salary is $95,000 per annum.", "$95,000", "COMPENSATION"),
            ("Discretionary year-end bonus: $20,000 approved.", "$20,000", "COMPENSATION"),
            ("Total comp package includes base $175,000/yr.", "$175,000", "COMPENSATION"),

            # 76-90: API Keys, Secrets & Private Tokens
            ("API key sk-live-9823984729384729384729384729 in production env.", "sk-live-9823984729384729384729384729", "API_KEY"),
            ("GitHub personal access token: ghp_111122223333444455556666777788889999 for repo sync.", "ghp_111122223333444455556666777788889999", "API_KEY"),
            ("Slack bot token xoxb-123456789012-987654321098-abcdef123456 configured.", "xoxb-123456789012-987654321098-abcdef123456", "API_KEY"),
            ("AWS access key ID AKIAIOSFODNN7EXAMPLE used in S3 script.", "AKIAIOSFODNN7EXAMPLE", "API_KEY"),
            ("OpenAI secret key: sk-proj-1234567890abcdef1234567890abcdef12345678 active.", "sk-proj-1234567890abcdef1234567890abcdef12345678", "API_KEY"),
            ("Bearer token bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0 in headers.", "bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0", "API_KEY"),
            ("GitHub deploy token: ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789.", "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", "API_KEY"),
            ("Slack webhook signing secret: xoxp-987654321098-123456789012-zxcvbn123456.", "xoxp-987654321098-123456789012-zxcvbn123456", "API_KEY"),
            ("AWS credential key AKIA1122334455667788 stored in local config.", "AKIA1122334455667788", "API_KEY"),
            ("Auth token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "API_KEY"),
            ("OpenAI key sk-test-0987654321fedcba0987654321fedcba in staging.", "sk-test-0987654321fedcba0987654321fedcba", "API_KEY"),
            ("Admin bearer token: bearer f9e8d7c6b5a41029384756102938475610293847.", "bearer f9e8d7c6b5a41029384756102938475610293847", "API_KEY"),
            ("Slack API user token xoxa-223344556677-889900112233-aabbccdd1122.", "xoxa-223344556677-889900112233-aabbccdd1122", "API_KEY"),
            ("GitHub PAT ghp_Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2 deployed.", "ghp_Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2", "API_KEY"),
            ("Key: sk-ant-api03-1234567890123456789012345678901234567890 for Claude.", "sk-ant-api03-1234567890123456789012345678901234567890", "API_KEY"),

            # 91-100: Founder-Private Restricted Files & Topics (Quarantine Validation)
            ("Private notes on founder exit options 2026.", "notes/founder_private/exit-options-2026.md", "FOUNDER_PRIVATE"),
            ("Draft board presentation deck with investor valuation.", "notes/founder_private/board-deck-drafts/deck1.md", "FOUNDER_PRIVATE"),
            ("Personal guarantee on Meridian line of credit.", "notes/founder_private/bank-line-and-personal-guarantee.md", "FOUNDER_PRIVATE"),
            ("Private compensation review for executive staff.", "notes/founder_private/comp-thoughts-priya-arjun.md", "FOUNDER_PRIVATE"),
            ("Confidential 1-on-1 notes across leadership team.", "notes/founder_private/1-1-notes-all.md", "FOUNDER_PRIVATE"),
            ("Confidential founder hiring shortlist.", "notes/founder_private/who-i-would-hire-next.md", "FOUNDER_PRIVATE"),
            ("Owner discussion regarding partner 301 credit settlement.", "notes/founder_private/northgate-owner-conversation.md", "FOUNDER_PRIVATE"),
            ("Personal income tax filings and shareholder distributions.", "notes/founder_private/personal-tax-2026.md", "FOUNDER_PRIVATE"),
            ("Private reflections from founder on company direction.", "notes/founder_private/things-im-not-ready-to-say.md", "FOUNDER_PRIVATE"),
            ("Sensitive folder notes/founder_private/INDEX.md index.", "notes/founder_private/INDEX.md", "FOUNDER_PRIVATE")
        ]

        self.assertEqual(len(test_cases), 100, f"Expected exactly 100 test cases, got {len(test_cases)}")

        leaks = []
        for idx, (raw_text, sensitive_needle, category) in enumerate(test_cases, 1):
            if category == "FOUNDER_PRIVATE":
                # Path-based quarantine test
                res = self.sanitizer.sanitize_text(raw_text, source_path=sensitive_needle)
                if not res["is_quarantined"]:
                    leaks.append(f"Case {idx} ({category}): Failed to quarantine path '{sensitive_needle}'")
            else:
                # Value-based redaction test
                res = self.sanitizer.sanitize_text(raw_text)
                sanitized_text = res["sanitized_text"]
                # The raw sensitive needle must NOT appear anywhere in the sanitized text
                if sensitive_needle in sanitized_text:
                    leaks.append(f"Case {idx} ({category}): Sensitive value '{sensitive_needle}' leaked into sanitized text: '{sanitized_text}'")

        # Zero leaks tolerance
        self.assertEqual(len(leaks), 0, f"Detected {len(leaks)} sensitive value leaks:\n" + "\n".join(leaks))
        print(f"SUCCESS: Verified all 100 sensitive test cases. Zero leaks detected into shared knowledge storage.")

if __name__ == "__main__":
    unittest.main()
