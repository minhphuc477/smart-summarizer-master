# Chức năng "Đọc cho tôi nghe" (Text-to-Speech)

## Tổng quan
Chức năng Text-to-Speech (TTS) đã được tích hợp vào Smart Summarizer, cho phép người dùng nghe nội dung được tóm tắt thay vì chỉ đọc.

## Công nghệ sử dụng
- **Web Speech API**: API có sẵn trong trình duyệt hiện đại, không cần cài đặt thêm
- **React Hooks**: Custom hook `useSpeech` để quản lý trạng thái TTS
- **Lucide Icons**: Icon `Volume2` và `VolumeX` để hiển thị trạng thái

## Các file đã thêm/sửa đổi

### 1. `/lib/useSpeech.ts` (MỚI)
Custom React hook quản lý Web Speech API:
- `speak(text, options)`: Phát âm văn bản
- `pause()`: Tạm dừng
- `resume()`: Tiếp tục
- `stop()`: Dừng hoàn toàn
- `isSpeaking`: Trạng thái đang phát
- `isSupported`: Kiểm tra trình duyệt có hỗ trợ không

**Tùy chọn khi phát âm:**
```typescript
speak(text, {
  rate: 1.0,      // Tốc độ (0.1 - 10)
  pitch: 1.0,     // Cao độ (0 - 2)
  volume: 1.0,    // Âm lượng (0 - 1)
  lang: 'vi-VN'   // Ngôn ngữ
});
```

### 2. `/components/SummarizerApp.tsx` (ĐÃ SỬA ĐỔI)
Đã thêm:
- Import `useSpeech` hook và các icon `Volume2`, `VolumeX`
- State `currentSpeaking` để theo dõi phần nào đang được đọc
- Hàm `handleSpeak()` để toggle TTS cho từng phần
- Nút speaker bên cạnh nút Copy trong 3 cards:
  - Summary (TL;DR)
  - Key Takeaways
  - Action Items

## Cách sử dụng

### Từ giao diện người dùng
1. Tạo summary như bình thường
2. Khi kết quả hiển thị, bạn sẽ thấy icon loa (🔊) bên cạnh icon copy
3. Click vào icon loa để nghe nội dung
4. Click lại lần nữa để dừng (icon sẽ chuyển thành 🔇)

### Các tính năng
- ✅ Tự động phát âm bằng giọng tiếng Việt
- ✅ Hiển thị trạng thái đang phát (icon xanh)
- ✅ Click để toggle bật/tắt
- ✅ Tự động dừng khi chuyển sang phần khác
- ✅ Hỗ trợ đọc Summary, Takeaways, Actions

## Tương thích trình duyệt
Web Speech API được hỗ trợ trên:
- ✅ Chrome/Edge (tốt nhất)
- ✅ Safari
- ✅ Firefox (một số hạn chế)
- ❌ Internet Explorer (không hỗ trợ)

## Lưu ý kỹ thuật
- Không cần server backend hay API key
- Hoạt động hoàn toàn offline sau khi tải trang
- Sử dụng giọng text-to-speech mặc định của hệ điều hành
- Trên Windows: Microsoft voices
- Trên macOS: Apple voices
- Trên Linux: eSpeak hoặc các TTS engine đã cài

## Mở rộng trong tương lai
Có thể thêm:
- Thanh điều khiển tốc độ đọc
- Chọn giọng đọc khác nhau
- Tải xuống file âm thanh MP3
- Hỗ trợ nhiều ngôn ngữ
- Progress bar hiển thị tiến độ đọc
