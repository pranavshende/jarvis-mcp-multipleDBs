import sys
import os
import docx
from docx.shared import Inches, Pt, RGBColor
sys.path.append(os.path.dirname(__file__))
from docx_styler import (
    setup_document, add_title, add_heading_1, add_heading_2, add_heading_3,
    add_paragraph, add_bullet, add_callout, create_styled_table,
    COLOR_NAVY, COLOR_BLUE, COLOR_TEAL, COLOR_RED, COLOR_AMBER, COLOR_GREEN
)

def build_transcripts_index_docx(output_path):
    doc = docx.Document()
    setup_document(doc)

    add_title(
        doc,
        "Raw AI Transcripts: Index",
        subtitle="Unedited Verification Exports & Complete Case Mapping for Assessment Deliverable 4",
        metadata_dict={
            "Document Title": "Authoritative Raw AI Transcripts Index",
            "Submission": "eigi.ai FDE Intern · Round 2 · Deliverable 4 of 4",
            "Compliance Rule": "Transcripts are unedited exports matching Deliverable 3",
            "Repository Path": "EIGI_FDE_SUBMISSION/06_Raw_AI_Transcripts/",
            "Snapshot Baseline": "October 20, 2026 13:30 UTC",
            "Access Permission": "Anyone with the link can view"
        }
    )

    add_heading_1(doc, "Authoritative Transcript Index Table")
    add_paragraph(
        doc,
        "The table below indexes the raw, unedited transcripts and execution logs for every chronological phase of the assessment, matching Deliverable 3 (AI Usage Log) row-for-row:"
    )

    headers = ["Log step", "Tool", "Transcript link or file name", "Matches log row?"]
    data = [
        ["0 Inventory", "Gemini 2.5 Pro", "06_Raw_AI_Transcripts/Step_0_Inventory_Gemini_2.5_Pro.md", "[X] Yes"],
        ["1 Joins", "Claude Code", "06_Raw_AI_Transcripts/Step_1_Joins_Claude_Code.md", "[X] Yes"],
        ["2 Question 1", "Gemini 2.5 Flash", "06_Raw_AI_Transcripts/Step_2_Question1_Gemini_2.5_Flash.md", "[X] Yes"],
        ["3 Question 2", "Claude 3.5 Sonnet", "06_Raw_AI_Transcripts/Step_3_Question2_Claude_3.5_Sonnet.md", "[X] Yes"],
        ["4 Question 3", "Gemini 2.5 Pro", "06_Raw_AI_Transcripts/Step_4_Question3_Gemini_2.5_Pro.md", "[X] Yes"],
        ["5 Design", "Claude Code", "06_Raw_AI_Transcripts/Step_5_Design_Claude_Code.md", "[X] Yes"],
        ["6 Final pass (recomputation)", "Claude chat + Python", "06_Raw_AI_Transcripts/Step_6_Final_Pass_Recomputation.md", "[X] Yes"]
    ]

    create_styled_table(doc, headers, data, col_widths=[1.5, 1.3, 3.0, 1.0])

    add_heading_1(doc, "Empirical Forensic Case Mapping")
    add_paragraph(
        doc,
        "As mandated by the assessment rules, each real AI failure and recomputation case is findable within the designated transcript files:"
    )

    add_bullet(
        doc,
        "Located in Step 2 (Step_2_Question1_Gemini_2.5_Flash.md). Documents the human engineer catching and overruling a naive UTC date filter that omitted 4 West Coast evening intake packages.",
        "Case 1 (96 versus 103 packages): "
    )
    add_bullet(
        doc,
        "Located in Step 3 (Step_3_Question2_Claude_3.5_Sonnet.md). Documents the human engineer disproving the LLM assertion of high profitability by reconciling 1.20% bullion spread dilution and $291.8k fixed opex to reveal a 0.39% GAAP net margin.",
        "Case 2 (20.4% claim vs 16.14% books): "
    )
    add_bullet(
        doc,
        "Located in Step 4 (Step_4_Question3_Gemini_2.5_Pro.md). Documents the rejection of unconstrained vector chat ingestion to prevent leaking executive salaries and private founder acquisition notes.",
        "Case 3 (Ingestion & Privacy Boundaries): "
    )
    add_bullet(
        doc,
        "Located in Step 6 (Step_6_Final_Pass_Recomputation.md). Documents the exact Python reconciliation establishing -$69,912.23 (before write-down) and -$132,742.23 (after lower-of-cost-or-market reprint write-down).",
        "Case 4 (Final Pass Recomputation): "
    )

    add_heading_1(doc, "Access & Sharing Permissions")
    add_callout(
        doc,
        "All linked files are available directly in the submitted repository under EIGI_FDE_SUBMISSION/06_Raw_AI_Transcripts/. If reviewing via Google Drive or cloud storage, ensure permissions for this index document and all linked markdown files are set to 'Anyone with the link can view'.",
        title="SHARING COMPLIANCE INSTRUCTION",
        box_type="info"
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)
    print(f"Generated Deliverable 4 Docx: {output_path}")

if __name__ == "__main__":
    out_file = os.path.join(os.path.dirname(__file__), "..", "EIGI_FDE_SUBMISSION", "04_Raw_AI_Transcripts_Index.docx")
    build_transcripts_index_docx(out_file)

