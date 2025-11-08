// Centralized embedding configuration and guidance helpers.
// If you change model or dimension, update migrations (vector(dim)) and RPC functions accordingly.
export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSION = 384; // all-MiniLM-L6-v2 output size

export function embeddingMismatchGuidance(dbDim?: number | null) {
  const expected = EMBEDDING_DIMENSION;
  if (!dbDim) {
    return 'No existing embeddings found. If dimension errors appear on insert, ensure the notes.embedding column is vector(' + expected + ').';
  }
  if (dbDim === expected) {
    return 'Dimensions match (' + expected + '). No action required.';
  }
  return `Database embeddings dimension (${dbDim}) does not match expected (${expected}). Options: \n` +
    `1) Keep DB at ${dbDim}: switch model & pipeline to one producing ${dbDim} dims; update EMBEDDING_DIMENSION constant.\n` +
    `2) Change DB to ${expected}: ALTER TABLE notes DROP COLUMN embedding; ALTER TABLE notes ADD COLUMN embedding vector(${expected}); re-run semantic search migration functions; backfill embeddings.`;
}
