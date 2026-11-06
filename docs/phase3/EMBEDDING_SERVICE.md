# Jarvis v1 — Embedding Service Documentation

## 1. Architecture & Model Selection

The Embedding Service (`server/services/rag/embedding_service.py`) provides provider-independent vector generation:
- **Target Dimensions**: **384 dimensions** (matching `jarvis_memory.document_chunks.embedding vector(384)`).
- **Supported Providers**:
  - `openai`: `text-embedding-3-small` (configured with `dimensions=384`).
  - `local_semantic`: High-precision deterministic subword and n-gram projection with positional TF-IDF weighting and L2 normalization (used for fast, dependency-free local execution).
- **Caching**: SHA-256 content hash cache prevents duplicate vector generation for unchanged text chunks.
- **Batching**: Automatic batch slicing (32 chunks per batch) with exponential retry backoff.
- **Validation**: Enforces `len(vector) == 384` prior to persistence.
