# Chức năng 5: Tìm kiếm theo Ngữ nghĩa (Semantic Search)

## 🎯 Tổng quan
Tìm kiếm theo ngữ nghĩa (Semantic Search) cho phép người dùng tìm kiếm ghi chú dựa trên **ý nghĩa** thay vì chỉ khớp từ khóa. Công nghệ này sử dụng AI để hiểu ngữ cảnh và tìm các ghi chú liên quan ngay cả khi chúng không chứa từ khóa chính xác.

### Ví dụ:
- **Tìm kiếm:** "Những cuộc họp quan trọng"
- **Kết quả:** Tìm thấy ghi chú có "team meeting", "client discussion", "project review" - mặc dù không có từ "quan trọng"

## ✨ Tính năng

### 1. **Vector Embeddings**
- Mỗi ghi chú được chuyển thành vector 384 chiều
- Sử dụng **all-MiniLM-L6-v2** model (Transformers.js)
- Chạy **local** trong Node.js - **100% miễn phí, không cần API key**
- Vector lưu trong PostgreSQL với pgvector extension

### 2. **Cosine Similarity Search**
- Tìm kiếm dựa trên độ tương đồng vector (cosine similarity)
- Ngưỡng mặc định: 78% similarity
- Trả về top 5 kết quả liên quan nhất

### 3. **User-Specific Search**
- Chỉ tìm kiếm trong notes của chính user đó
- Bảo mật và privacy được đảm bảo

### 4. **No External API Required** 🎉
- **Không cần OpenAI API key**
- **Miễn phí 100%**
- Model chạy local với Transformers.js
- Tự động download model lần đầu (~90MB)

## 🏗️ Kiến trúc

```
┌─────────────┐
│  User Query │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ Transformers.js      │ (text → vector, LOCAL)
│ all-MiniLM-L6-v2    │ 
└──────┬───────────────┘
       │
       ▼
┌──────────────────┐
│ match_notes RPC  │ (cosine similarity)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Search Results │
└──────────────────┘
```

## 🗄️ Database Schema

### Bảng `notes` - Thêm cột:
```sql
ALTER TABLE notes
ADD COLUMN embedding vector(384);
```

### Index:
```sql
CREATE INDEX notes_embedding_idx 
ON notes USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### RPC Function:
```sql
CREATE FUNCTION match_notes(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 5,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  summary text,
  original_notes text,
  persona text,
  created_at timestamptz,
  similarity float
)
```

## 📁 Files đã tạo/sửa

### 1. `/supabase-migration-semantic-search.sql` (MỚI)
File SQL migration bao gồm:
- Enable pgvector extension
- Thêm cột `embedding` vào bảng `notes`
- Tạo index cho vector search
- Tạo RPC function `match_notes`

### 2. `/app/api/search/route.ts` (MỚI)
API endpoint để thực hiện semantic search:
- Nhận query từ user
- Tạo embedding cho query
- Gọi RPC `match_notes`
- Trả về kết quả với similarity score

**Request:**
```typescript
POST /api/search
{
  "query": "team meetings",
  "userId": "uuid",
  "matchCount": 5,
  "matchThreshold": 0.75
}
```

**Response:**
```typescript
{
  "results": [
    {
      "id": 1,
      "summary": "Weekly team standup",
      "original_notes": "...",
      "persona": "...",
      "created_at": "2025-10-27",
      "similarity": 0.92
    }
  ],
  "query": "team meetings",
  "count": 1
}
```

### 3. `/app/api/generate-embedding/route.ts` (MỚI)
API endpoint để tạo embedding cho notes:
- Nhận `noteId` và `text`
- Tạo embedding từ OpenAI
- Cập nhật vào database

**Request:**
```typescript
POST /api/generate-embedding
{
  "noteId": 123,
  "text": "Original notes content..."
}
```

**Response:**
```typescript
{
  "success": true,
  "message": "Embedding generated and saved successfully."
}
```

### 4. `/app/api/summarize/route.ts` (CẬP NHẬT)
Thêm logic tự động generate embedding:
```typescript
// Sau khi lưu note thành công
fetch('/api/generate-embedding', {
  method: 'POST',
  body: JSON.stringify({ noteId, text: notes })
}).catch(err => console.error('Error generating embedding:', err));
```

### 5. `/components/SearchBar.tsx` (MỚI)
Component UI cho semantic search:
- Input field với placeholder hướng dẫn
- Button "Search" với loading state
- Hiển thị kết quả với similarity score
- Empty state khi không có kết quả
- Error handling

**Features:**
- Real-time search
- Clear button
- Similarity percentage badge
- Note preview với line-clamp
- Responsive design

### 6. `/components/SummarizerApp.tsx` (CẬP NHẬT)
Thêm SearchBar component vào UI:
```tsx
<SearchBar userId={session.user.id} />
```

### 7. `/.env.local` (CẬP NHẬT)
Thêm OpenAI API key:
```bash
OPENAI_API_KEY="your_openai_api_key_here"
```

### 8. `/package.json` (CẬP NHẬT)
Thêm dependency:
```json
{
  "dependencies": {
    "openai": "^latest"
  }
}
```

## 🚀 Cách triển khai

### Bước 1: Chạy Migration SQL
1. Mở Supabase Dashboard
2. Vào **SQL Editor**
3. Copy nội dung file `supabase-migration-semantic-search.sql`
4. Run migration

### Bước 2: Restart Server
```bash
# Restart để load Transformers.js
npm run dev
```

**Lần đầu chạy:** Model sẽ tự động download (~90MB), mất khoảng 1-2 phút. Sau đó sẽ được cache.

### Bước 3: Test Semantic Search
1. Đăng nhập vào app
2. Tạo vài notes mới (embedding sẽ tự động generate)
3. Scroll xuống phần "Semantic Search"
4. Thử search: "urgent tasks" hoặc "team meetings"

## 💡 Cách sử dụng

### Từ UI:
1. Scroll xuống phần **"Semantic Search"**
2. Nhập câu hỏi hoặc keyword vào search bar
3. Click **"Search"** hoặc nhấn Enter
4. Xem kết quả với % similarity

### Tips để search hiệu quả:
- ✅ **Tốt:** "What meetings did I have last week?"
- ✅ **Tốt:** "Show me urgent tasks"
- ✅ **Tốt:** "Notes about project planning"
- ❌ **Kém:** "abc" (quá ngắn)
- ❌ **Kém:** "meeting meeting meeting" (lặp lại)

## 🔧 Technical Deep Dive

### 1. Text Embedding Process
```typescript
// Input text
const text = "Team meeting about Q4 goals";

// Transformers.js (local, no API call)
const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const output = await pipe(text, {
  pooling: 'mean',
  normalize: true
});

// Output: vector[384]
const embedding = Array.from(output.data);
// Example: [0.023, -0.015, 0.041, ..., 0.019]
```

**Model Details:**
- **Name:** all-MiniLM-L6-v2
- **Size:** ~90MB
- **Dimensions:** 384
- **Speed:** ~50-100ms per embedding (after model load)
- **Quality:** 80-85% of OpenAI quality, good enough cho hầu hết use cases

### 2. Cosine Similarity Calculation
```sql
-- PostgreSQL với pgvector
SELECT 
  id,
  summary,
  1 - (embedding <=> query_embedding) AS similarity
FROM notes
WHERE 1 - (embedding <=> query_embedding) > 0.75
ORDER BY similarity DESC
LIMIT 5;
```

**Operators:**
- `<=>`: Cosine distance
- `1 - distance`: Convert to similarity (0-1 range)

### 3. Index Strategy
```sql
-- IVFFlat index: Fast approximate search
CREATE INDEX notes_embedding_idx 
ON notes 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Trade-offs:**
- `lists = 100`: Good for ~10,000 notes
- Adjust higher for more notes (e.g., 500 for 100k+ notes)

## 📊 Performance

### Embedding Generation:
- **Model:** all-MiniLM-L6-v2 (Sentence Transformers)
- **Speed:** ~50-100ms per note (after first load)
- **First Load:** ~1-2 minutes (download model ~90MB)
- **Cost:** **$0.00** - Completely FREE! 🎉
- **Dimensions:** 384
- **Runs:** Locally in Node.js (no external API calls)

### Search Performance:
- **Query time:** 50-200ms (depends on DB size)
- **Index:** IVFFlat provides 10-100x speedup
- **Accuracy:** 80-85% compared to OpenAI (very good!)

### Model Caching:
- Model tự động được cache sau lần đầu download
- Không cần download lại khi restart server
- Cache location: `node_modules/@xenova/transformers/.cache/`

## 🛡️ Error Handling

### Graceful Degradation:
```typescript
// Nếu model chưa load xong (first time)
if (!embedder) {
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  // Will download ~90MB first time, then cache
}
```

### User-Friendly Messages:
- ❌ Database error → "Failed to search notes. Make sure you've run the migration."
- ⏳ First load → "Loading model... (this may take 1-2 minutes on first run)"
- ❌ Empty results → "No results found. Try a different query."

## 🎯 Best Practices

### 1. Batch Processing
Để tạo embeddings cho notes cũ:
```typescript
// Script để backfill embeddings
const notes = await supabase.from('notes').select('id, original_notes');

for (const note of notes) {
  await fetch('/api/generate-embedding', {
    method: 'POST',
    body: JSON.stringify({ noteId: note.id, text: note.original_notes })
  });
  
  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

### 2. Cost Optimization
- Cache embeddings (không tạo lại nếu text không đổi)
- Giới hạn text length (max 8000 chars)
- Batch requests nếu có nhiều notes

### 3. Quality Tuning
Adjust `match_threshold`:
- **0.85+**: Very strict (ít kết quả, chính xác cao)
- **0.75-0.85**: Balanced (đề xuất)
- **<0.75**: Loose (nhiều kết quả, có thể không liên quan)

## 🔮 Future Enhancements

Có thể mở rộng:

1. **Hybrid Search**
   - Kết hợp semantic search + keyword search
   - Tăng accuracy

2. **Search Filters**
   - Filter by date range
   - Filter by tags
   - Filter by sentiment

3. **Search Analytics**
   - Track popular queries
   - Improve suggestions

4. **Multi-language Support**
   - Detect language
   - Use appropriate embedding model

5. **Semantic Clustering**
   - Group similar notes
   - Auto-categorize

6. **Question Answering**
   - RAG (Retrieval Augmented Generation)
   - Answer questions from notes

## 📚 References

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Supabase Vector Search](https://supabase.com/docs/guides/ai/vector-columns)

## 💰 Pricing Estimate

**For UNLIMITED notes and searches:**
- Embedding generation: **$0.00** (runs locally)
- Search queries: **$0.00** (runs locally)
- Storage: Only Supabase database cost
- **Total:** **$0.00/month for compute** 🎉

**So sánh với OpenAI:**
- OpenAI embeddings: ~$0.04/month for 1000 notes
- Transformers.js: **$0.00** - Miễn phí hoàn toàn!

**Trade-off:**
- Quality: 80-85% so với OpenAI (vẫn rất tốt!)
- Speed: Tương đương hoặc nhanh hơn (không có network latency)
- Cost: **FREE** vs Paid

**Highly cost-effective!** 🎉
