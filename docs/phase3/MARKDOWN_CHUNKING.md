# Jarvis v1 — Smart Markdown Chunking Documentation

## 1. Chunking Specifications

The Smart Markdown Chunker (`server/services/rag/chunker.py`) splits complex documents into semantically coherent segments suitable for vector search:
- **Target Size**: 512 tokens (~2,048 characters).
- **Overlap**: 10% (~50 tokens / 200 characters).
- **Preserved Hierarchy**: Maintains heading stack (`Document -> H1 -> H2 -> H3`) and assigns each chunk a human-readable `section_path`.
- **List Continuity**: Bullet points and numbered procedures are kept within contiguous chunks.

---

## 2. Table Integrity Strategy

A critical limitation of naive fixed-window chunkers is splitting tables mid-row or losing column headers:
1. Tables are buffered as atomic blocks.
2. If a table fits within the 512-token budget, it is kept intact with its preceding context.
3. If an oversized table exceeds the budget, the chunker automatically replicates the column header and delimiter rows across all split sub-chunks.
4. Chunks maintain table semantics without loss of column context.
