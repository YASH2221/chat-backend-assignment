export type ChatType = 'direct' | 'group';

export type ChatMemberRole = 'admin' | 'member';

export interface ChatMember {
  userId: string;
  role: ChatMemberRole;
  joinedAt: Date;
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatWithMembers extends Chat {
  memberIds: string[];
}

export interface ChatDetails extends ChatWithMembers {
  members: ChatMember[];
}
