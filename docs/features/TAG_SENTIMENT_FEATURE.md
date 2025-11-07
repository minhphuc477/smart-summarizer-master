# Chức năng 4: Tự động gắn Tag & Phân tích Cảm xúc

## 🎯 Tổng quan
Chức năng này tự động phân tích và gắn tags (từ khóa) cũng như xác định cảm xúc (sentiment) của ghi chú khi người dùng tạo summary.

## ✨ Tính năng

### 1. **Tự động gắn Tags**
- AI tự động tạo 3-5 tags liên quan đến nội dung ghi chú
- Tags được lưu vào database và có thể tái sử dụng
- Hiển thị dưới dạng badges màu xanh với prefix `#`
- Mỗi user có bộ tags riêng

### 2. **Phân tích Cảm xúc (Sentiment Analysis)**
- AI phân tích và xác định tone cảm xúc của văn bản
- 3 loại sentiment:
  - **Positive** 😊 - Tích cực, vui vẻ
  - **Neutral** 😐 - Trung lập, khách quan
  - **Negative** 😞 - Tiêu cực, lo lắng
- Hiển thị bằng emoji và label rõ ràng

## 🗄️ Cấu trúc Database

### Bảng `notes`
```sql
- id (int8, primary key)
- user_id (uuid, foreign key -> auth.users)
- created_at (timestamptz)
- persona (text)
- original_notes (text)
- summary (text)
- takeaways (_text)
- actions (_text)
- sentiment (text) -- MỚI: 'positive', 'neutral', or 'negative'
```

### Bảng `tags`
```sql
- id (int8, primary key)
- user_id (uuid, foreign key -> auth.users)
- name (text)
```

### Bảng `note_tags` (Junction Table)
```sql
- tag_id (int8, foreign key -> tags.id)
- note_id (int8, foreign key -> notes.id)
- Primary key: (tag_id, note_id)
```

## 📁 Files đã thay đổi

### 1. `/lib/groq.ts`
**Thay đổi:** Cập nhật system prompt để AI trả về thêm 2 fields:
- `tags`: Array of strings (3-5 tags)
- `sentiment`: String ('positive', 'neutral', or 'negative')

### 2. `/app/api/summarize/route.ts`
**Thay đổi:** Logic xử lý tags và lưu vào database
- Nhận `userId` từ request
- Lưu note với sentiment
- Xử lý từng tag:
  - Kiểm tra tag đã tồn tại chưa
  - Tạo tag mới nếu chưa có
  - Tạo liên kết trong bảng `note_tags`

**Flow:**
```
1. AI generates summary + tags + sentiment
2. Insert note to `notes` table
3. For each tag:
   a. Check if tag exists for this user
   b. If not, create new tag in `tags` table
   c. Link note and tag in `note_tags` table
```

### 3. `/components/SummarizerApp.tsx`
**Thay đổi:**
- Cập nhật type `SummaryResult` với `tags?` và `sentiment?`
- Thêm functions: `getSentimentEmoji()`, `getSentimentLabel()`
- Gửi `userId` trong API call
- Hiển thị Tags & Sentiment card mới sau Summary card
- Tags hiển thị dạng badges màu xanh
- Sentiment hiển thị với emoji + label

### 4. `/components/History.tsx`
**Thay đổi:**
- Cập nhật type `Note` để include `sentiment` và `note_tags`
- Query Supabase với JOIN để lấy tags:
  ```typescript
  .select(`
    id, created_at, summary, persona, sentiment,
    note_tags!inner (
      tags!inner (id, name)
    )
  `)
  ```
- Hiển thị sentiment emoji bên phải mỗi note
- Hiển thị tags dưới dạng badges

### 5. `/supabase-migration-sentiment.sql` (MỚI)
File SQL migration để thêm cột `sentiment` vào bảng `notes`:
- Thêm column với default value 'neutral'
- Thêm constraint để đảm bảo giá trị hợp lệ
- Tạo index cho performance

## 🚀 Cách sử dụng

### Bước 1: Chạy Migration SQL
1. Mở Supabase Dashboard
2. Vào **SQL Editor**
3. Copy nội dung file `supabase-migration-sentiment.sql`
4. Paste và Run

### Bước 2: Test tính năng
1. Tạo một summary mới
2. Sau khi AI xử lý, bạn sẽ thấy:
   - Card "Tags & Sentiment" hiển thị ngay sau Summary
   - Tags dạng badges màu xanh (vd: #work #meeting #urgent)
   - Sentiment với emoji và label

### Bước 3: Xem lịch sử
1. Scroll xuống phần "History"
2. Mỗi note sẽ có:
   - Sentiment emoji ở góc phải
   - Tags badges ở phía dưới

## 🎨 UI/UX

### Tags Display
```tsx
<span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800">
  #work
</span>
```

### Sentiment Display
```tsx
<div className="flex items-center gap-2">
  <span className="text-3xl">😊</span>
  <span className="text-lg font-medium">Positive</span>
</div>
```

## 🔧 Technical Details

### AI Prompt Enhancement
```typescript
After adopting the persona, you must provide the output ONLY in a valid JSON format with FIVE keys:
1. "summary": A summary written entirely in the voice of the persona.
2. "takeaways": An array of key points, also written in the persona's voice.
3. "actions": A simple array of clear action items.
4. "tags": An array of 3-5 relevant tags/keywords (e.g., ["work", "meeting", "urgent"]).
5. "sentiment": The overall emotional tone. Must be one of: "positive", "neutral", or "negative".
```

### Tag Management Logic
```typescript
// Pseudo-code
for each tag in tags:
  existingTag = findTag(tag, userId)
  if existingTag:
    tagId = existingTag.id
  else:
    newTag = createTag(tag, userId)
    tagId = newTag.id
  linkNoteAndTag(noteId, tagId)
```

### Supabase Query với JOIN
```typescript
const { data } = await supabase
  .from('notes')
  .select(`
    id, created_at, summary, persona, sentiment,
    note_tags!inner (
      tags!inner (id, name)
    )
  `)
  .order('created_at', { ascending: false })
  .limit(10);
```

## 📊 Example Output

### JSON từ AI:
```json
{
  "summary": "Project meeting went well, team is aligned.",
  "takeaways": [
    "Sprint goals are clear",
    "Everyone committed to deadlines"
  ],
  "actions": [
    "Update project board",
    "Send meeting notes"
  ],
  "tags": ["work", "meeting", "project", "sprint"],
  "sentiment": "positive"
}
```

### Database Records:

**notes table:**
| id | user_id | summary | sentiment |
|----|---------|---------|-----------|
| 1  | uuid-123| Project meeting went well... | positive |

**tags table:**
| id | user_id | name |
|----|---------|------|
| 1  | uuid-123| work |
| 2  | uuid-123| meeting |
| 3  | uuid-123| project |
| 4  | uuid-123| sprint |

**note_tags table:**
| note_id | tag_id |
|---------|--------|
| 1       | 1      |
| 1       | 2      |
| 1       | 3      |
| 1       | 4      |

## 🎯 Benefits

1. **Tổ chức tốt hơn:** Tags giúp phân loại và tìm kiếm notes dễ dàng
2. **Insight cảm xúc:** Hiểu được tone của ghi chú (tích cực/tiêu cực)
3. **Tái sử dụng tags:** Tags được tạo một lần, dùng cho nhiều notes
4. **User-specific:** Mỗi user có bộ tags riêng, không bị conflict
5. **Visual feedback:** Emoji và colors giúp nhận diện nhanh

## 🔮 Mở rộng trong tương lai

Có thể thêm:
- **Tag filtering:** Lọc notes theo tags
- **Tag cloud:** Hiển thị top tags được dùng nhiều nhất
- **Sentiment trends:** Biểu đồ thể hiện xu hướng cảm xúc theo thời gian
- **Tag suggestions:** AI suggest tags based on history
- **Custom tags:** User có thể thêm/sửa tags manually
- **Tag colors:** Mỗi tag có màu khác nhau
- **Tag management page:** Trang quản lý tags (rename, merge, delete)
