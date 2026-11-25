import type { Timestamp } from 'firebase-admin/firestore';

export interface FirestoreMessageDocument {
  chatId: string;
  senderId: string;
  text: string;
  timestamp: Timestamp;
  readBy: Record<string, Timestamp>;
  isEdited: boolean;
  isDeleted: boolean;
  updatedAt: Timestamp | null;
}

export interface FirestoreLastSeenDocument {
  chatId: string;
  userId: string;
  messageId: string;
  updatedAt: Timestamp;
}

export interface MessageView {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: string;
  readBy: Record<string, string>;
  isEdited: boolean;
  isDeleted: boolean;
  updatedAt: string | null;
}

export interface MarkReadResult {
  chatId: string;
  messageId: string;
  userId: string;
  readAt: string;
  alreadyRead: boolean;
}

export interface LastSeenResult {
  chatId: string;
  userId: string;
  messageId: string;
  updatedAt: string;
}
