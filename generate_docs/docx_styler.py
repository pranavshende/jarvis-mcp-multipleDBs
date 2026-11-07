import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

# Color Palette Constants
COLOR_NAVY = RGBColor(15, 37, 55)       # #0F2537 Deep Navy
COLOR_BLUE = RGBColor(37, 99, 235)      # #2563EB Primary Blue
COLOR_TEAL = RGBColor(13, 148, 136)     # #0D9488 Secondary Teal
COLOR_DARK = RGBColor(31, 41, 55)       # #1F2937 Dark Body
COLOR_GRAY = RGBColor(107, 114, 128)    # #6B7280 Muted Gray
COLOR_RED = RGBColor(220, 38, 38)       # #DC2626 Critical Red
COLOR_AMBER = RGBColor(217, 119, 6)     # #D97706 Warning Amber
COLOR_GREEN = RGBColor(22, 163, 74)     # #16A34A Success Green

HEX_NAVY = "0F2537"
HEX_BLUE = "2563EB"
HEX_TEAL = "0D9488"
HEX_RED = "DC2626"
HEX_AMBER = "D97706"
HEX_LIGHT_GRAY = "F3F4F6"
HEX_CODE_BG = "F8FAFC"
HEX_BORDER = "E5E7EB"
HEX_WARNING_BG = "FEF3C7"
HEX_ALERT_BG = "FEE2E2"
HEX_INFO_BG = "EFF6FF"
HEX_SUCCESS_BG = "F0FDF4"

def setup_document(doc):
    """Sets standard 0.8 inch margins and default styles"""
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
        
        # Configure Header & Footer
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("Meridian Supply Chain · Jarvis v1 Architecture & Founder Answers")
        hrun.font.name = "Calibri"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = COLOR_GRAY
        
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        frun = fp.add_run("Confidential · eigi.ai FDE Round 2 Assessment Submission · Page ")
        frun.font.name = "Calibri"
        frun.font.size = Pt(8.5)
        frun.font.color.rgb = COLOR_GRAY
        
        # Add page number XML
        fldSimple = OxmlElement('w:fldSimple')
        fldSimple.set(qn('w:instr'), 'PAGE')
        fp._p.append(fldSimple)

def add_title(doc, title, subtitle=None, metadata_dict=None):
    """Adds a modern executive cover / title block"""
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(12)
    title_p.paragraph_format.space_after = Pt(4)
    run = title_p.add_run(title)
    run.font.name = "Arial"
    run.font.size = Pt(22)
    run.font.bold = True
    run.font.color.rgb = COLOR_NAVY
    
    if subtitle:
        sub_p = doc.add_paragraph()
        sub_p.paragraph_format.space_before = Pt(0)
        sub_p.paragraph_format.space_after = Pt(12)
        s_run = sub_p.add_run(subtitle)
        s_run.font.name = "Calibri"
        s_run.font.size = Pt(12)
        s_run.font.italic = True
        s_run.font.color.rgb = COLOR_TEAL

    if metadata_dict:
        meta_table = doc.add_table(rows=len(metadata_dict), cols=2)
        meta_table.alignment = WD_TABLE_ALIGNMENT.LEFT
        set_table_borders(meta_table, color="D1D5DB", sz="4", val="single")
        
        r_idx = 0
        for k, v in metadata_dict.items():
            cell_k = meta_table.cell(r_idx, 0)
            cell_v = meta_table.cell(r_idx, 1)
            
            cell_k.width = Inches(2.2)
            cell_v.width = Inches(4.6)
            
            set_cell_bg(cell_k, "F9FAFB")
            set_cell_margins(cell_k, top=60, bottom=60, left=100, right=100)
            set_cell_margins(cell_v, top=60, bottom=60, left=100, right=100)
            
            p_k = cell_k.paragraphs[0]
            p_k.paragraph_format.space_after = Pt(0)
            r_k = p_k.add_run(k)
            r_k.font.name = "Calibri"
            r_k.font.size = Pt(9.5)
            r_k.font.bold = True
            r_k.font.color.rgb = COLOR_NAVY
            
            p_v = cell_v.paragraphs[0]
            p_v.paragraph_format.space_after = Pt(0)
            r_v = p_v.add_run(str(v))
            r_v.font.name = "Calibri"
            r_v.font.size = Pt(9.5)
            r_v.font.color.rgb = COLOR_DARK
            r_idx += 1
            
        doc.add_paragraph().paragraph_format.space_after = Pt(12)

def add_heading_1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(15)
    run.font.bold = True
    run.font.color.rgb = COLOR_NAVY
    return p

def add_heading_2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(12.5)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLUE
    return p

def add_heading_3(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(11)
    run.font.bold = True
    run.font.color.rgb = COLOR_DARK
    return p

def add_paragraph(doc, text, bold_prefix=None, space_after=6, italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.name = "Calibri"
        r_pre.font.size = Pt(10)
        r_pre.font.bold = True
        r_pre.font.color.rgb = COLOR_DARK
    r = p.add_run(text)
    r.font.name = "Calibri"
    r.font.size = Pt(10)
    r.font.italic = italic
    r.font.color.rgb = COLOR_DARK
    return p

def add_bullet(doc, text, bold_prefix=None, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    if level > 0:
        p.paragraph_format.left_indent = Inches(0.25 * level)
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.name = "Calibri"
        r_pre.font.size = Pt(10)
        r_pre.font.bold = True
        r_pre.font.color.rgb = COLOR_DARK
    r = p.add_run(text)
    r.font.name = "Calibri"
    r.font.size = Pt(10)
    r.font.color.rgb = COLOR_DARK
    return p

def add_callout(doc, text, title="KEY TAKEAWAY", box_type="info"):
    """Adds a modern bordered callout box"""
    bg_color = HEX_INFO_BG
    border_color = HEX_BLUE
    prefix_color = COLOR_BLUE
    
    if box_type == "alert" or box_type == "danger":
        bg_color = HEX_ALERT_BG
        border_color = HEX_RED
        prefix_color = COLOR_RED
    elif box_type == "warning":
        bg_color = HEX_WARNING_BG
        border_color = HEX_AMBER
        prefix_color = COLOR_AMBER
    elif box_type == "success":
        bg_color = HEX_SUCCESS_BG
        border_color = HEX_TEAL
        prefix_color = COLOR_TEAL

    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    cell = table.cell(0, 0)
    cell.width = Inches(6.8)
    set_cell_bg(cell, bg_color)
    set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
    
    # Left thick border, no other borders
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>\n'
        f'  <w:top w:val="none"/>\n'
        f'  <w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>\n'
        f'  <w:bottom w:val="none"/>\n'
        f'  <w:right w:val="none"/>\n'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    
    r_t = p.add_run(f"[{title}] ")
    r_t.font.name = "Arial"
    r_t.font.size = Pt(9.5)
    r_t.font.bold = True
    r_t.font.color.rgb = prefix_color
    
    r_b = p.add_run(text)
    r_b.font.name = "Calibri"
    r_b.font.size = Pt(9.5)
    r_b.font.color.rgb = COLOR_DARK
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_code_block(doc, code_text, language="SQL"):
    """Adds a monospace formatted code snippet block"""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    cell = table.cell(0, 0)
    cell.width = Inches(6.8)
    set_cell_bg(cell, HEX_CODE_BG)
    set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
    
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>\n'
        f'  <w:top w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>\n'
        f'  <w:left w:val="single" w:sz="18" w:space="0" w:color="{HEX_NAVY}"/>\n'
        f'  <w:bottom w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>\n'
        f'  <w:right w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>\n'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.05
    
    run_lang = p.add_run(f"-- {language.upper()} SPECIFICATION\n")
    run_lang.font.name = "Consolas"
    run_lang.font.size = Pt(8.5)
    run_lang.font.bold = True
    run_lang.font.color.rgb = COLOR_TEAL
    
    run = p.add_run(code_text)
    run.font.name = "Consolas"
    run.font.size = Pt(8.5)
    run.font.color.rgb = COLOR_DARK
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def create_styled_table(doc, headers, data, col_widths=None):
    """Creates a professional styled data table"""
    table = doc.add_table(rows=len(data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    # Format Header Row
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = ""
        set_cell_bg(hdr_cells[i], HEX_NAVY)
        set_cell_margins(hdr_cells[i], top=70, bottom=70, left=90, right=90)
        p = hdr_cells[i].paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.05
        run = p.add_run(h)
        run.font.name = "Arial"
        run.font.size = Pt(9)
        run.font.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)
        
    # Format Data Rows
    for row_idx, row_data in enumerate(data):
        row_cells = table.rows[row_idx + 1].cells
        bg_hex = "FFFFFF" if row_idx % 2 == 0 else "F9FAFB"
        for col_idx, val in enumerate(row_data):
            row_cells[col_idx].text = ""
            set_cell_bg(row_cells[col_idx], bg_hex)
            set_cell_margins(row_cells[col_idx], top=50, bottom=50, left=90, right=90)
            p = row_cells[col_idx].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            
            # Check alignment (if number or currency, right align)
            val_str = str(val)
            if (val_str.startswith("$") or val_str.endswith("%") or 
                (val_str.replace(",", "").replace(".", "").replace("-", "").isdigit() and len(val_str) < 12)):
                if not ("SKU" in val_str or "PART" in val_str or "PO-" in val_str):
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                    
            run = p.add_run(val_str)
            run.font.name = "Calibri"
            run.font.size = Pt(9)
            run.font.color.rgb = COLOR_DARK
            
    # Set Widths if provided
    if col_widths:
        for row in table.rows:
            for idx, width in enumerate(col_widths):
                row.cells[idx].width = Inches(width)
                
    set_table_borders(table, color="E5E7EB", sz="4", val="single")
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    return table

def set_cell_bg(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=50, bottom=50, left=80, right=80):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>\n'
        f'  <w:top w:w="{top}" w:type="dxa"/>\n'
        f'  <w:bottom w:w="{bottom}" w:type="dxa"/>\n'
        f'  <w:left w:w="{left}" w:type="dxa"/>\n'
        f'  <w:right w:w="{right}" w:type="dxa"/>\n'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table, color="D1D5DB", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>\n'
        f'  <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>\n'
        f'  <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>\n'
        f'  <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>\n'
        f'  <w:insideV w:val="none"/>\n'
        f'  <w:left w:val="none"/>\n'
        f'  <w:right w:val="none"/>\n'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)
