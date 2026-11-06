# -*- coding: utf-8 -*-
"""
Smart Markdown Semantic Chunker.
Structure-aware chunking preserving Markdown heading hierarchy, list continuity,
and table integrity with 512-token target size and 10% overlap.
"""
import re
import hashlib
import uuid
import logging

logger = logging.getLogger("jarvis.rag.chunker")

class MarkdownChunker:
    def __init__(self, target_tokens=512, overlap_pct=0.10):
        self.target_tokens = target_tokens
        self.overlap_tokens = int(target_tokens * overlap_pct)
        # Approximate 1 token ≈ 4 characters
        self.chars_per_token = 4
        self.target_chars = target_tokens * self.chars_per_token
        self.overlap_chars = self.overlap_tokens * self.chars_per_token

    def _estimate_tokens(self, text):
        return max(1, len(text) // self.chars_per_token)

    def _is_heading(self, line):
        return bool(re.match(r"^#{1,6}\s+", line.strip()))

    def _get_heading_level(self, line):
        match = re.match(r"^(#{1,6})\s+(.*)$", line.strip())
        if match:
            return len(match.group(1)), match.group(2).strip()
        return 0, ""

    def _is_table_row(self, line):
        stripped = line.strip()
        return stripped.startswith("|") and stripped.endswith("|")

    def _is_table_separator(self, line):
        stripped = line.strip()
        return bool(re.match(r"^\|(?:\s*:?-+:?\s*\|)+$", stripped))

    def chunk_markdown(self, text, document_title="Untitled Document", source_filename=""):
        """
        Chunks markdown document preserving heading hierarchy and table integrity.
        Returns a list of structured chunk dictionaries.
        """
        if not text or not text.strip():
            return []

        lines = text.split("\n")
        chunks = []
        
        # Track heading stack: [(level, heading_text), ...]
        heading_stack = []
        current_section_heading = document_title
        current_section_path = document_title

        current_lines = []
        current_char_count = 0
        table_buffer = []
        table_header_lines = []

        def get_section_path():
            if not heading_stack:
                return document_title
            return " -> ".join([document_title] + [h[1] for h in heading_stack])

        def flush_table():
            nonlocal table_buffer, table_header_lines, current_lines, current_char_count
            if not table_buffer:
                return
            
            table_text = "\n".join(table_buffer)
            table_chars = len(table_text)

            # If table alone exceeds target_chars, chunk with repeated headers
            if table_chars > self.target_chars and len(table_header_lines) >= 2:
                rows = table_buffer[len(table_header_lines):]
                header_block = "\n".join(table_header_lines)
                header_chars = len(header_block)

                sub_rows = []
                sub_chars = header_chars
                for row in rows:
                    if sub_chars + len(row) + 1 > self.target_chars and sub_rows:
                        # Flush current table chunk
                        chunk_content = header_block + "\n" + "\n".join(sub_rows)
                        emit_chunk(chunk_content)
                        sub_rows = [row]
                        sub_chars = header_chars + len(row) + 1
                    else:
                        sub_rows.append(row)
                        sub_chars += len(row) + 1
                if sub_rows:
                    emit_chunk(header_block + "\n" + "\n".join(sub_rows))
            else:
                # Add table to current chunk buffer
                current_lines.append(table_text)
                current_char_count += table_chars + 1

            table_buffer = []
            table_header_lines = []

        def emit_chunk(content_str):
            content_str = content_str.strip()
            if not content_str:
                return

            c_hash = hashlib.sha256(content_str.encode("utf-8")).hexdigest()
            t_count = self._estimate_tokens(content_str)
            chunk_obj = {
                "chunk_id": str(uuid.uuid4()),
                "chunk_index": len(chunks),
                "document_title": document_title,
                "source_filename": source_filename,
                "section_heading": current_section_heading,
                "section_path": current_section_path,
                "content": content_str,
                "content_hash": c_hash,
                "token_count": t_count,
                "metadata": {
                    "document_title": document_title,
                    "source_filename": source_filename,
                    "section_heading": current_section_heading,
                    "section_path": current_section_path,
                    "heading_depth": len(heading_stack)
                }
            }
            chunks.append(chunk_obj)

        def flush_chunk(force=False):
            nonlocal current_lines, current_char_count
            if not current_lines:
                return

            content = "\n".join(current_lines).strip()
            if not content:
                current_lines = []
                current_char_count = 0
                return

            emit_chunk(content)

            # Compute overlap text from tail
            if not force and self.overlap_chars > 0 and current_char_count > self.overlap_chars:
                overlap_lines = []
                acc = 0
                for l in reversed(current_lines):
                    if acc + len(l) + 1 <= self.overlap_chars:
                        overlap_lines.insert(0, l)
                        acc += len(l) + 1
                    else:
                        break
                current_lines = overlap_lines
                current_char_count = acc
            else:
                current_lines = []
                current_char_count = 0

        # Main line processing loop
        i = 0
        in_code_block = False

        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            # Handle fenced code blocks
            if stripped.startswith("```"):
                in_code_block = not in_code_block
                current_lines.append(line)
                current_char_count += len(line) + 1
                i += 1
                continue

            # Inside code block: preserve exactly
            if in_code_block:
                current_lines.append(line)
                current_char_count += len(line) + 1
                i += 1
                continue

            # Table row handling
            if self._is_table_row(line):
                table_buffer.append(line)
                if len(table_buffer) <= 2:
                    table_header_lines.append(line)
                i += 1
                continue
            else:
                if table_buffer:
                    flush_table()

            # Heading handling
            if self._is_heading(line):
                level, h_text = self._get_heading_level(line)
                
                # Flush previous content before major section break (h1 or h2)
                if current_char_count > 100:
                    flush_chunk(force=True)

                # Update heading stack
                while heading_stack and heading_stack[-1][0] >= level:
                    heading_stack.pop()
                heading_stack.append((level, h_text))

                current_section_heading = h_text
                current_section_path = get_section_path()

                current_lines.append(line)
                current_char_count += len(line) + 1
                i += 1
                continue

            # Standard paragraph / list / text
            current_lines.append(line)
            current_char_count += len(line) + 1

            # Check if target chars exceeded at natural paragraph break (empty line)
            if current_char_count >= self.target_chars and not stripped:
                flush_chunk()

            i += 1

        # Final flush
        if table_buffer:
            flush_table()
        if current_lines:
            flush_chunk(force=True)

        return chunks
