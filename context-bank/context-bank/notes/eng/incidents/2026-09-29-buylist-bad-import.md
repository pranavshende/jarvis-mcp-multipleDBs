# Incident — bad buy list import (2026-09-29)

**Impact:** 38 bullion SKUs listed at 10× buy price for 26 minutes. 4 submissions created at the wrong price; honoured
2 (small), cancelled 2 with apology credits.
**Cause:** CSV import treated a comma as decimal separator. Import done by a script using the integration API key.
**Fix:** validation on import (max ±40% change per row without confirmation). Script now prompts before writing.
