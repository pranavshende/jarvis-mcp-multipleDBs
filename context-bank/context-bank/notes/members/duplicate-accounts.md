# Duplicate member accounts

_Owner: Hannah Cole · draft · 2026-07-08_

We know some people have more than one account (referral bonus abuse, splitting big submissions, or just forgetting
they signed up). We don't have a dedupe process.

What we've seen:
- Same phone number on 2–3 accounts.
- Same PayPal payout email on different accounts.
- Names that are close but not identical ("J. Smith" / "James Smith").
- Same street address.

What we do today: nothing systematic. Support spots it occasionally. Arjun has a ticket (ENG-412) to add a unique
constraint on phone, blocked on "what do we do with existing duplicates".

Why it matters: per-member limits, fraud (one person spreading resealed boxes across accounts), and member counts in
investor updates are inflated.
