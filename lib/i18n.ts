import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Common
      "welcome": "Welcome",
      "loading": "Loading...",
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "create": "Create",
      "search": "Search",
      "filter": "Filter",
      "clear": "Clear",
      "searching": "Searching...",
      
      // App specific
      "smartNoteSummarizer": "Smart Note Summarizer",
      "pasteYourNotes": "Paste your messy notes",
      "customPersona": "Custom AI Persona (optional)",
      "summarize": "Summarize",
      "summary": "Summary",
      "keyTakeaways": "Key Takeaways",
      "actionItems": "Action Items",
      "tags": "Tags",
      "sentiment": "Sentiment",
      "history": "History",
      "folders": "Folders",
      "workspaces": "Workspaces",
      "templates": "Templates",
      "analytics": "Analytics",
      "canvas": "Canvas",
      "settings": "Settings",
      
      // Search
      "semanticSearch": "Semantic Search",
      "semanticSearchDescription": "Search your notes by meaning, not just keywords. Try asking questions like \"What meetings did I have?\" or \"Show me urgent tasks\"",
      "searchPlaceholder": "Search your notes by meaning...",
      "minSimilarity": "Min similarity",
      "minSimilarityThreshold": "Minimum similarity threshold",
      
      // Guest mode
      "guestMode": "Guest Mode",
      "usesLeft": "uses left",
      "signIn": "Sign In",
      "signOut": "Sign Out",
      
      // Templates
      "useTemplate": "Use Template",
      "meetingNotes": "Meeting Notes",
      "dailyStandup": "Daily Standup",
      "projectUpdate": "Project Update",
      "codeReview": "Code Review",
      "brainstorming": "Brainstorming Session",
      
      // Analytics
      "totalNotes": "Total Notes",
      "totalSummaries": "Total Summaries",
      "activeD ays": "Active Days",
      "wordsProcessed": "Words Processed",
      
      // Voice
      "startRecording": "Start Recording",
      "stopRecording": "Stop Recording",
      "listening": "Listening...",
      
      // Encryption
      "encrypted": "Encrypted",
      "encrypt": "Encrypt",
      "decrypt": "Decrypt",
      "enterPassword": "Enter Password",
    }
  },
  vi: {
    translation: {
      // Common
      "welcome": "Chào mừng",
      "loading": "Đang tải...",
      "save": "Lưu",
      "cancel": "Hủy",
      "delete": "Xóa",
      "edit": "Sửa",
      "create": "Tạo",
      "search": "Tìm kiếm",
      "filter": "Lọc",
      "clear": "Xóa",
      "searching": "Đang tìm...",
      
      // App specific
      "smartNoteSummarizer": "Tóm Tắt Ghi Chú Thông Minh",
      "pasteYourNotes": "Dán ghi chú của bạn",
      "customPersona": "Persona AI tùy chỉnh (tùy chọn)",
      "summarize": "Tóm Tắt",
      "summary": "Tóm Tắt",
      "keyTakeaways": "Điểm Chính",
      "actionItems": "Hành Động",
      "tags": "Thẻ",
      "sentiment": "Cảm Xúc",
      "history": "Lịch Sử",
      "folders": "Thư Mục",
      "workspaces": "Không Gian Làm Việc",
      "templates": "Mẫu",
      "analytics": "Phân Tích",
      "canvas": "Bảng Vẽ",
      "settings": "Cài Đặt",
      
      // Search
      "semanticSearch": "Tìm Kiếm Ngữ Nghĩa",
      "semanticSearchDescription": "Tìm kiếm ghi chú của bạn theo ý nghĩa, không chỉ từ khóa. Thử đặt câu hỏi như \"Tôi đã có những cuộc họp nào?\" hoặc \"Hiển thị công việc khẩn cấp\"",
      "searchPlaceholder": "Tìm kiếm ghi chú theo ý nghĩa...",
      "minSimilarity": "Độ tương đồng tối thiểu",
      "minSimilarityThreshold": "Ngưỡng độ tương đồng tối thiểu",
      
      // Guest mode
      "guestMode": "Chế Độ Khách",
      "usesLeft": "lượt còn lại",
      "signIn": "Đăng Nhập",
      "signOut": "Đăng Xuất",
      
      // Templates
      "useTemplate": "Dùng Mẫu",
      "meetingNotes": "Ghi Chú Cuộc Họp",
      "dailyStandup": "Standup Hàng Ngày",
      "projectUpdate": "Cập Nhật Dự Án",
      "codeReview": "Đánh Giá Code",
      "brainstorming": "Buổi Động Não",
      
      // Analytics
      "totalNotes": "Tổng Ghi Chú",
      "totalSummaries": "Tổng Tóm Tắt",
      "activeDays": "Ngày Hoạt Động",
      "wordsProcessed": "Từ Đã Xử Lý",
      
      // Voice
      "startRecording": "Bắt Đầu Ghi Âm",
      "stopRecording": "Dừng Ghi Âm",
      "listening": "Đang nghe...",
      
      // Encryption
      "encrypted": "Đã Mã Hóa",
      "encrypt": "Mã Hóa",
      "decrypt": "Giải Mã",
      "enterPassword": "Nhập Mật Khẩu",
    }
  },
  zh: {
    translation: {
      "welcome": "欢迎",
      "smartNoteSummarizer": "智能笔记摘要器",
      "pasteYourNotes": "粘贴您的笔记",
      "summarize": "总结",
      "summary": "摘要",
      "keyTakeaways": "要点",
      "actionItems": "行动项",
      "signIn": "登录",
      "signOut": "登出",
    }
  },
  ja: {
    translation: {
      "welcome": "ようこそ",
      "smartNoteSummarizer": "スマートノート要約",
      "pasteYourNotes": "メモを貼り付ける",
      "summarize": "要約する",
      "summary": "要約",
      "keyTakeaways": "重要なポイント",
      "actionItems": "アクションアイテム",
      "signIn": "ログイン",
      "signOut": "ログアウト",
    }
  },
  ko: {
    translation: {
      "welcome": "환영합니다",
      "smartNoteSummarizer": "스마트 노트 요약기",
      "pasteYourNotes": "메모를 붙여넣으세요",
      "summarize": "요약",
      "summary": "요약",
      "keyTakeaways": "주요 사항",
      "actionItems": "실행 항목",
      "signIn": "로그인",
      "signOut": "로그아웃",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
