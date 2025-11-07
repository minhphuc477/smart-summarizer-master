# Calendar Links Feature

## Tổng quan

Tính năng Calendar Links cho phép người dùng thêm action items có thời gian cụ thể vào lịch của họ thông qua nhiều nền tảng khác nhau (Google Calendar, Outlook, Office 365, Yahoo Calendar, hoặc tải file ICS).

## Cách hoạt động

### 1. AI Datetime Detection

AI (Groq) được cập nhật để tự động phát hiện thời gian trong văn bản và trả về cấu trúc action items mới:

```typescript
type ActionItem = {
  task: string;
  datetime: string | null; // ISO 8601 format
};
```

**Ví dụ:**
- "Send report tomorrow at 2pm" → `{ task: "Send report", datetime: "2024-01-15T14:00:00Z" }`
- "Call client next Monday 10am" → `{ task: "Call client", datetime: "2024-01-20T10:00:00Z" }`
- "Review code" → `{ task: "Review code", datetime: null }`

### 2. Calendar Link Generation

File `/lib/calendarLinks.ts` cung cấp utilities để tạo links cho 5 nền tảng:

```typescript
generateCalendarLinks({
  task: "Send report",
  datetime: "2024-01-15T14:00:00Z",
  duration: 60, // minutes (optional, default 60)
  description: "Summary context..." // optional
});

// Returns:
{
  google: "https://calendar.google.com/calendar/render?...",
  outlook: "https://outlook.live.com/calendar/0/deeplink/compose?...",
  office365: "https://outlook.office.com/calendar/0/deeplink/compose?...",
  yahoo: "https://calendar.yahoo.com/?v=60&...",
  ics: "data:text/calendar;charset=utf8,BEGIN:VCALENDAR..."
}
```

### 3. UI Integration

Trong `SummarizerApp.tsx`, mỗi action item có datetime sẽ hiển thị một nút Calendar (📅):

```tsx
{item.datetime && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        <Calendar className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>Google Calendar</DropdownMenuItem>
      <DropdownMenuItem>Outlook.com</DropdownMenuItem>
      <DropdownMenuItem>Office 365</DropdownMenuItem>
      <DropdownMenuItem>Yahoo Calendar</DropdownMenuItem>
      <DropdownMenuItem>Download ICS</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

## Các thành phần chính

### 1. Type Definitions

**File: `/lib/guestMode.ts`**
```typescript
export type ActionItem = {
  task: string;
  datetime: string | null;
};

export type GuestNote = {
  // ... other fields
  actions: ActionItem[];
};
```

### 2. AI Prompt Update

**File: `/lib/groq.ts`**

System prompt được cập nhật:

```
For ACTIONS:
- Return as array of objects: {task: string, datetime: string|null}
- Detect datetime from text like "tomorrow at 2pm", "next Monday 10am"
- Convert to ISO 8601 format (e.g., "2024-01-15T14:00:00Z")
- Use current date as reference
- If no time mentioned, set datetime to null
```

### 3. Calendar Utilities

**File: `/lib/calendarLinks.ts`**

**Main Functions:**

1. **`generateCalendarLinks(options: CalendarLinkOptions)`**
   - Tạo links cho tất cả 5 providers
   - Input: `{ task, datetime, duration?, description? }`
   - Output: Object với keys: `google`, `outlook`, `office365`, `yahoo`, `ics`

2. **`downloadICS(task, datetime, duration?, description?)`**
   - Tải file .ics về máy
   - Tương thích với tất cả calendar apps hỗ trợ iCalendar format

**Internal Functions:**
- `generateGoogleCalendarLink()` - Google Calendar URL
- `generateOutlookLink()` - Outlook.com URL
- `generateOffice365Link()` - Office 365 URL
- `generateYahooLink()` - Yahoo Calendar URL
- `generateICSFile()` - iCalendar format string
- `formatDateForGoogle()` - Format: `YYYYMMDDTHHMMSSZ`
- `formatDateForOutlook()` - Format: `YYYY-MM-DDTHH:MM:SS`

### 4. UI Components

**File: `/components/SummarizerApp.tsx`**

**Imports:**
```typescript
import { generateCalendarLinks, downloadICS } from '@/lib/calendarLinks';
import { Calendar } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
```

**Rendering:**
- Action items hiển thị task text
- Nếu có datetime: hiển thị thời gian và nút calendar
- Click vào nút calendar → dropdown với 5 options
- Click vào provider → mở link trong tab mới
- Click "Download ICS" → tải file về máy

## Date/Time Formats

### Input (AI Detection)
AI cần nhận diện các dạng:
- "tomorrow at 2pm" → Next day 14:00
- "next Monday 10am" → Coming Monday 10:00
- "in 3 hours" → Current time + 3h
- "January 15 at 3:30pm" → Specific date/time
- "15/1/2024 2pm" → Specific date/time

### Output (ISO 8601)
All datetime được chuyển về ISO 8601:
```
2024-01-15T14:00:00Z
```

### Display Format
Trong UI hiển thị dạng readable:
```typescript
new Date(item.datetime).toLocaleString()
// Output: "1/15/2024, 2:00:00 PM"
```

## Workflow Example

### User Input:
```
Notes: "Meeting với client về dự án mới. Cần prepare slides và demo. 
Send follow-up email tomorrow at 2pm."
```

### AI Processing:
```json
{
  "summary": "Cuộc họp với client về dự án mới, cần chuẩn bị slides và demo",
  "takeaways": [
    "Prepare presentation slides",
    "Create demo for client"
  ],
  "actions": [
    {
      "task": "Send follow-up email",
      "datetime": "2024-01-15T14:00:00Z"
    }
  ]
}
```

### UI Display:
```
Actions:
• Send follow-up email (1/15/2024, 2:00:00 PM) [📅 Calendar]
```

### User Clicks Calendar Button:
Dropdown shows:
- Google Calendar
- Outlook.com
- Office 365
- Yahoo Calendar
- Download ICS

### User Selects "Google Calendar":
Browser opens:
```
https://calendar.google.com/calendar/render?
  action=TEMPLATE&
  text=Send+follow-up+email&
  dates=20240115T140000Z/20240115T150000Z&
  details=Cuộc+họp+với+client...
```

## Browser Compatibility

### Calendar Links (Cloud-based)
- ✅ Chrome/Edge/Firefox/Safari - All modern browsers
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ⚠️ Opens trong new tab/window

### ICS Download
- ✅ Desktop browsers - Download file .ics
- ✅ Mobile browsers - Download file
- ℹ️ User cần app hỗ trợ .ics (Apple Calendar, Outlook, etc.)

## Testing

### Manual Testing Steps:

1. **Create a note with time-based action:**
   ```
   "Review PR tomorrow at 3pm"
   ```

2. **Verify AI extracts datetime:**
   - Check result.actions contains `{ task: "Review PR", datetime: "2024-XX-XXT15:00:00Z" }`

3. **Check UI renders correctly:**
   - Action item shows task text
   - Datetime displayed in readable format
   - Calendar icon button appears

4. **Test each calendar provider:**
   - Click calendar button
   - Select each provider
   - Verify link opens with correct details
   - Verify date/time is accurate

5. **Test ICS download:**
   - Click "Download ICS"
   - Verify file downloads
   - Open file in calendar app
   - Confirm event details correct

### Edge Cases:

1. **No datetime detected:**
   ```typescript
   { task: "Review code", datetime: null }
   // Should NOT show calendar button
   ```

2. **Invalid datetime:**
   ```typescript
   datetime: "invalid-date"
   // Should handle gracefully (skip calendar button)
   ```

3. **Past datetime:**
   ```typescript
   datetime: "2020-01-01T10:00:00Z"
   // Should still work (calendar apps handle past events)
   ```

4. **Very long task names:**
   - Calendar links should truncate properly
   - UI should not break layout

## Integration với Guest Mode

Guest users cũng có thể sử dụng calendar links:

```typescript
// Guest note được lưu với ActionItem[] type
type GuestNote = {
  actions: ActionItem[]; // Not string[]
};

// Calendar links work for both guest and logged-in users
```

## Limitations

1. **AI Datetime Detection:**
   - Phụ thuộc vào Groq AI accuracy
   - Một số format phức tạp có thể không nhận diện được
   - Timezone phụ thuộc vào server/AI interpretation

2. **Calendar Integration:**
   - Không tự động sync, chỉ tạo links
   - User phải click để add vào calendar
   - Không có 2-way sync với calendar apps

3. **ICS File:**
   - Không tự động import
   - User cần manually mở file
   - Một số email clients có thể block .ics attachments

## Future Enhancements

### Potential Improvements:

1. **Timezone Support:**
   - Detect user timezone
   - Allow manual timezone selection
   - Display time in user's local timezone

2. **Recurring Events:**
   - Support "every Monday at 10am"
   - RRULE in ICS files

3. **Duration Customization:**
   - Allow users to set custom duration
   - Default duration by task type

4. **Calendar Integration:**
   - OAuth with Google Calendar API
   - Direct add to calendar (no link click needed)
   - Sync back to show event status

5. **Reminders:**
   - Add reminder options to events
   - Email/push notification integration

6. **Smart Scheduling:**
   - Suggest optimal times based on calendar
   - Avoid conflicts with existing events

## Dependencies

### NPM Packages:
- No additional packages needed! Pure JavaScript/TypeScript

### UI Components:
- `shadcn/ui` dropdown-menu (already installed)
- `lucide-react` Calendar icon (already installed)

### APIs:
- No external APIs required
- All calendar link generation is client-side

## Troubleshooting

### Issue: Calendar button không xuất hiện
**Solution:** 
- Check action item có `datetime` field
- Verify datetime không phải null
- Check AI prompt đã update chưa

### Issue: Calendar link không hoạt động
**Solution:**
- Verify datetime format là ISO 8601
- Check URL encoding đúng
- Test trên browser khác

### Issue: ICS file không download
**Solution:**
- Check browser popup blocker
- Verify file content hợp lệ
- Try different browser

### Issue: Datetime hiển thị sai múi giờ
**Solution:**
- Datetime được lưu dạng UTC (Z suffix)
- Browser tự động convert sang local time
- Check system timezone settings

## Security Considerations

1. **URL Generation:**
   - All parameters được encode properly
   - Prevent XSS through URL manipulation

2. **ICS File:**
   - Content sanitized
   - No executable code in .ics file

3. **Privacy:**
   - No data sent to third-party servers
   - All generation happens client-side
   - Calendar details only visible khi user click

## Performance

- ⚡ Calendar link generation: < 1ms
- 📦 Bundle size impact: ~2KB (calendarLinks.ts)
- 🎨 UI rendering: No performance impact
- 💾 Storage: ActionItem type compatible với existing data

---

**Version:** 1.0.0  
**Created:** 2024-01-14  
**Last Updated:** 2024-01-14  
**Author:** Smart Summarizer Team
