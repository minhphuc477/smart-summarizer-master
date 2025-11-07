// Guest mode utilities
// Cho phép người dùng sử dụng app mà không cần đăng nhập
// với giới hạn số lần sử dụng và lưu vào localStorage

const GUEST_STORAGE_KEY = 'smart-summarizer-guest';
const GUEST_USAGE_LIMIT = 5; // Limit 5 summaries cho guest
const GUEST_HISTORY_LIMIT = 10; // Lưu tối đa 10 notes trong history

// ActionItem type for calendar integration
export type ActionItem = {
  task: string;
  datetime: string | null;
};

export type GuestNote = {
  id: string;
  original_notes: string;
  persona: string | null;
  summary: string;
  takeaways: string[];
  actions: ActionItem[];
  tags?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  created_at: string;
};

export type GuestData = {
  usageCount: number;
  history: GuestNote[];
  lastUsed: string;
};

// Khởi tạo guest data nếu chưa có
export function initGuestData(): GuestData {
  if (typeof window === 'undefined') {
    return { usageCount: 0, history: [], lastUsed: new Date().toISOString() };
  }

  const stored = localStorage.getItem(GUEST_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { usageCount: 0, history: [], lastUsed: new Date().toISOString() };
    }
  }
  
  const initialData: GuestData = {
    usageCount: 0,
    history: [],
    lastUsed: new Date().toISOString(),
  };
  
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
}

// Lấy guest data
export function getGuestData(): GuestData {
  if (typeof window === 'undefined') {
    return { usageCount: 0, history: [], lastUsed: new Date().toISOString() };
  }

  const stored = localStorage.getItem(GUEST_STORAGE_KEY);
  if (!stored) {
    return initGuestData();
  }

  try {
    return JSON.parse(stored);
  } catch {
    return initGuestData();
  }
}

// Lưu guest data
export function saveGuestData(data: GuestData): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
}

// Check xem guest còn quota không
export function canGuestUse(): boolean {
  const data = getGuestData();
  return data.usageCount < GUEST_USAGE_LIMIT;
}

// Lấy số lần còn lại
export function getRemainingUsage(): number {
  const data = getGuestData();
  return Math.max(0, GUEST_USAGE_LIMIT - data.usageCount);
}

// Increment usage count
export function incrementGuestUsage(): void {
  const data = getGuestData();
  data.usageCount += 1;
  data.lastUsed = new Date().toISOString();
  saveGuestData(data);
}

// Thêm note vào guest history
export function addGuestNote(note: Omit<GuestNote, 'id' | 'created_at'>): GuestNote {
  const data = getGuestData();
  
  const newNote: GuestNote = {
    ...note,
    id: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };
  
  // Thêm vào đầu array
  data.history.unshift(newNote);
  
  // Giới hạn số lượng history
  if (data.history.length > GUEST_HISTORY_LIMIT) {
    data.history = data.history.slice(0, GUEST_HISTORY_LIMIT);
  }
  
  saveGuestData(data);
  return newNote;
}

// Xóa một note khỏi guest history
export function deleteGuestNote(noteId: string): void {
  const data = getGuestData();
  data.history = data.history.filter(note => note.id !== noteId);
  saveGuestData(data);
}

// Xóa toàn bộ guest data (reset)
export function clearGuestData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GUEST_STORAGE_KEY);
}

// Get guest history
export function getGuestHistory(): GuestNote[] {
  const data = getGuestData();
  return data.history;
}

// Check if user is guest (không có session)
export function isGuestMode(session: { user?: unknown } | null | undefined): boolean {
  return !session || !('user' in session) || !session.user;
}

// Constants để export
export const GUEST_LIMITS = {
  USAGE_LIMIT: GUEST_USAGE_LIMIT,
  HISTORY_LIMIT: GUEST_HISTORY_LIMIT,
};
