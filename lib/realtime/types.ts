// Real-time collaboration types for smart-summarizer

export interface Comment {
  id: number;
  note_id: number;
  user_id: string;
  parent_id?: number;
  content: string;
  mentions: string[];
  resolved: boolean;
  created_at: string;
  updated_at: string;
  // Joined from users table
  user_email?: string;
  user_name?: string;
  user_avatar?: string;
}

export interface PresenceState {
  user_id: string;
  user_email?: string;
  user_name?: string;
  user_avatar?: string;
  status: 'viewing' | 'editing' | 'idle';
  cursor_position?: {
    x: number;
    y: number;
  };
  selection?: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  typing?: boolean;
  focused_element?: string; // ID of the element being edited (e.g., canvas node ID)
  last_seen: string;
}

export interface NoteVersion {
  id: number;
  note_id: number;
  user_id: string;
  version_number: number;
  original_notes?: string;
  summary?: string;
  takeaways?: string[];
  actions?: { task: string; datetime?: string | null }[];
  tags?: string[];
  sentiment?: string | null;
  change_description?: string;
  created_at: string;
  // Joined from users table
  user_email?: string;
  user_name?: string;
}

export interface CommentNotification {
  id: number;
  user_id: string;
  comment_id: number;
  read: boolean;
  created_at: string;
}

export interface RealtimeMessage {
  type: 'cursor' | 'selection' | 'typing' | 'custom';
  payload: unknown;
  user_id: string;
  timestamp: string;
}
