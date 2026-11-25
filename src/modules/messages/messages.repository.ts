import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CollectionReference, FieldPath, Timestamp } from 'firebase-admin/firestore';
import { FirestoreService } from '@/infrastructure/firebase/firestore.service';
import type {
  FirestoreLastSeenDocument,
  FirestoreMessageDocument,
  LastSeenResult,
  MarkReadResult,
  MessageView,
} from './interfaces/message-document.interface';

const DELETED_MESSAGE_PLACEHOLDER = 'This message was deleted';

@Injectable()
export class MessagesRepository {
  constructor(private readonly firestoreService: FirestoreService) {}

  private messagesCollection(chatId: string): CollectionReference {
    return this.firestoreService.firestore.collection('chats').doc(chatId).collection('messages');
  }

  private lastSeenCollection(chatId: string): CollectionReference {
    return this.firestoreService.firestore.collection('chats').doc(chatId).collection('lastSeen');
  }

  private mapDocToMessageView(id: string, data: FirestoreMessageDocument): MessageView {
    const readBy: Record<string, string> = {};
    for (const [uid, ts] of Object.entries(data.readBy ?? {})) {
      readBy[uid] = ts.toDate().toISOString();
    }

    return {
      id,
      chatId: data.chatId,
      senderId: data.senderId,
      text: data.text,
      timestamp: data.timestamp.toDate().toISOString(),
      readBy,
      isEdited: data.isEdited ?? false,
      isDeleted: data.isDeleted ?? false,
      updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
    };
  }

  async createMessage(chatId: string, senderId: string, text: string): Promise<MessageView> {
    const now = Timestamp.now();
    const docRef = this.messagesCollection(chatId).doc();

    const docData: FirestoreMessageDocument = {
      chatId,
      senderId,
      text,
      timestamp: now,
      readBy: {
        [senderId]: now,
      },
      isEdited: false,
      isDeleted: false,
      updatedAt: null,
    };

    await docRef.set(docData);
    return this.mapDocToMessageView(docRef.id, docData);
  }

  async getMessages(chatId: string, limit: number): Promise<MessageView[]> {
    const snapshot = await this.messagesCollection(chatId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const messages = snapshot.docs.map((doc) =>
      this.mapDocToMessageView(doc.id, doc.data() as FirestoreMessageDocument),
    );

    // Return chronological order (oldest -> newest) for the fetched slice
    return messages.reverse();
  }

  async editMessage(
    chatId: string,
    messageId: string,
    senderId: string,
    newText: string,
  ): Promise<MessageView> {
    const db = this.firestoreService.firestore;
    const messageRef = this.messagesCollection(chatId).doc(messageId);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(messageRef);
      if (!snap.exists) {
        throw new NotFoundException(`Message '${messageId}' not found in chat '${chatId}'`);
      }

      const data = snap.data() as FirestoreMessageDocument;
      if (data.senderId !== senderId) {
        throw new ForbiddenException('Only the message sender can edit this message');
      }
      if (data.isDeleted) {
        throw new BadRequestException('Cannot edit a deleted message');
      }

      const now = Timestamp.now();
      tx.update(messageRef, {
        text: newText,
        isEdited: true,
        updatedAt: now,
      });

      return this.mapDocToMessageView(messageId, {
        ...data,
        text: newText,
        isEdited: true,
        updatedAt: now,
      });
    });
  }

  async deleteMessage(chatId: string, messageId: string, senderId: string): Promise<MessageView> {
    const db = this.firestoreService.firestore;
    const messageRef = this.messagesCollection(chatId).doc(messageId);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(messageRef);
      if (!snap.exists) {
        throw new NotFoundException(`Message '${messageId}' not found in chat '${chatId}'`);
      }

      const data = snap.data() as FirestoreMessageDocument;
      if (data.senderId !== senderId) {
        throw new ForbiddenException('Only the message sender can delete this message');
      }
      if (data.isDeleted) {
        return this.mapDocToMessageView(messageId, data);
      }

      const now = Timestamp.now();
      tx.update(messageRef, {
        text: DELETED_MESSAGE_PLACEHOLDER,
        isDeleted: true,
        updatedAt: now,
      });

      return this.mapDocToMessageView(messageId, {
        ...data,
        text: DELETED_MESSAGE_PLACEHOLDER,
        isDeleted: true,
        updatedAt: now,
      });
    });
  }

  async markMessageRead(
    chatId: string,
    messageId: string,
    userId: string,
  ): Promise<MarkReadResult> {
    const db = this.firestoreService.firestore;
    const messageRef = this.messagesCollection(chatId).doc(messageId);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(messageRef);
      if (!snap.exists) {
        throw new NotFoundException(`Message '${messageId}' not found in chat '${chatId}'`);
      }

      const data = snap.data() as FirestoreMessageDocument;
      const existingReadAt = data.readBy?.[userId];
      if (existingReadAt) {
        return {
          chatId,
          messageId,
          userId,
          readAt: existingReadAt.toDate().toISOString(),
          alreadyRead: true,
        };
      }

      const now = Timestamp.now();
      tx.update(messageRef, new FieldPath('readBy', userId), now);

      return {
        chatId,
        messageId,
        userId,
        readAt: now.toDate().toISOString(),
        alreadyRead: false,
      };
    });
  }

  async updateLastSeen(chatId: string, userId: string, messageId: string): Promise<LastSeenResult> {
    const db = this.firestoreService.firestore;
    const messageRef = this.messagesCollection(chatId).doc(messageId);
    const lastSeenRef = this.lastSeenCollection(chatId).doc(userId);

    return db.runTransaction(async (tx) => {
      const msgSnap = await tx.get(messageRef);
      if (!msgSnap.exists) {
        throw new NotFoundException(`Message '${messageId}' not found in chat '${chatId}'`);
      }

      const now = Timestamp.now();
      const doc: FirestoreLastSeenDocument = {
        chatId,
        userId,
        messageId,
        updatedAt: now,
      };

      tx.set(lastSeenRef, doc, { merge: true });

      return {
        chatId,
        userId,
        messageId,
        updatedAt: now.toDate().toISOString(),
      };
    });
  }
}
