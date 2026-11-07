# MERIDIAN SUPPLY CHAIN · JARVIS ASSESSMENT
## Raw AI Transcripts: Index
*Unedited exports for every step in the AI log*

| Item | Detail |
| :--- | :--- |
| **Submission** | eigi.ai FDE intern · Round 2 · Deliverable 4 of 4 |
| **Rule** | Transcripts are unedited exports or share links; they must match Deliverable 3 |

---

### Authoritative Transcript Index Table

| Log step | Tool | Transcript link or file name | Matches log row? | Key Empirical Finding / Forensic Case |
| :--- | :--- | :--- | :---: | :--- |
| **0 Inventory** | Gemini 2.5 Pro | [`06_Raw_AI_Transcripts/Step_0_Inventory_Gemini_2.5_Pro.md`](./06_Raw_AI_Transcripts/Step_0_Inventory_Gemini_2.5_Pro.md) | ☑ | 362 files categorized across 9 domains; established snapshot date: Oct 20, 2026 13:30 UTC. |
| **1 Joins** | Claude Code | [`06_Raw_AI_Transcripts/Step_1_Joins_Claude_Code.md`](./06_Raw_AI_Transcripts/Step_1_Joins_Claude_Code.md) | ☑ | Cross-DB foreign key isolation identified; designed `dim_crosswalk_entities` CDC replication. |
| **2 Question 1** | Gemini 2.5 Flash | [`06_Raw_AI_Transcripts/Step_2_Question1_Gemini_2.5_Flash.md`](./06_Raw_AI_Transcripts/Step_2_Question1_Gemini_2.5_Flash.md) | ☑ | **Case 1 (96 vs 103 packages):** Timezone truncation error caught; local operating hours enforced. |
| **3 Question 2** | Claude 3.5 Sonnet | [`06_Raw_AI_Transcripts/Step_3_Question2_Claude_3.5_Sonnet.md`](./06_Raw_AI_Transcripts/Step_3_Question2_Claude_3.5_Sonnet.md) | ☑ | **Case 2 (20.4% claim vs 16.14% books):** Overruled gross trading spread; audited Sep GAAP net ($7.3k / 0.39%). |
| **4 Question 3** | Gemini 2.5 Pro | [`06_Raw_AI_Transcripts/Step_4_Question3_Gemini_2.5_Pro.md`](./06_Raw_AI_Transcripts/Step_4_Question3_Gemini_2.5_Pro.md) | ☑ | **Case 3 (Ingestion & ACH failure):** Stalled ACH payouts ($173.3k, GitHub #184) and Northgate ($284.3k owed). |
| **5 Design** | Claude Code | [`06_Raw_AI_Transcripts/Step_5_Design_Claude_Code.md`](./06_Raw_AI_Transcripts/Step_5_Design_Claude_Code.md) | ☑ | Fastify modular monolith on Hetzner Cloud (€112.40/mo); two-man rule confirmation gateway. |
| **6 Final pass (recomputation)** | Claude chat + Python | [`06_Raw_AI_Transcripts/Step_6_Final_Pass_Recomputation.md`](./06_Raw_AI_Transcripts/Step_6_Final_Pass_Recomputation.md) | ☑ | **Case 4 (October deficit recomputation):** Audited -$69.9k pre-impairment vs -$132.7k post-impairment. |

---

### Case Mapping Verification Guide
* **Case 1 (96 versus 103 packages):** Located in **Step 2** (`Step_2_Question1_Gemini_2.5_Flash.md`). Demonstrates the human engineer catching and overruling a naive UTC date filter that dropped 4 West Coast afternoon scans.
* **Case 2 (20.4% dashboard claim):** Located in **Step 3** (`Step_3_Question2_Claude_3.5_Sonnet.md`). Demonstrates the human engineer disproving the LLM's assertion of high profitability by factoring in bullion dilution and $291.8k fixed opex.
* **Case 3 (Ingestion & Privacy Boundaries):** Located in **Step 4** (`Step_4_Question3_Gemini_2.5_Pro.md`). Demonstrates rejecting unconstrained vector ingestion to protect founder notes and executive salaries via ABAC.
* **Case 4 (Recomputation of October Position):** Located in **Step 6** (`Step_6_Final_Pass_Recomputation.md`). Recomputes the exact mathematical bridge between -$69,912.23 (before write-down) and -$132,742.23 (after lower-of-cost-or-market reprint write-down).

---

### Access & Sharing Permissions
* **Local Workspace Paths:** All transcript files are permanently stored in `D:\eigi.ai\EIGI_FDE_SUBMISSION\06_Raw_AI_Transcripts\`.
* **Repository:** Hosted on GitHub main branch at `https://github.com/pranavshende/jarvis-mcp-multipleDBs/tree/main/EIGI_FDE_SUBMISSION/06_Raw_AI_Transcripts/`.
* **Google Drive / Cloud Share Instructions:** When uploading this folder or linked transcripts to Google Drive, set permissions to **"Anyone with the link can view"** as specified in the candidate brief.
