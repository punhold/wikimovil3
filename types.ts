
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface Badge {
  id: string;
  name: string;
  icon: string; // Emoji or icon name
  description: string;
  color: string; // Tailwind color class
}

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  role: UserRole;
  photoURL?: string;
  badges: Badge[]; // Gamification
}

export interface Comment {
  id: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  content: string;
  timestamp: number;
}

export interface Post {
  id: string;
  title: string; 
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  authorBadges?: Badge[]; // Display author badges on post
  content: string; // HTML content
  imageUrl?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  tags: string[];
  likes: number;
  comments: Comment[];
  timestamp: number;
  isVerified?: boolean; // Verified Solution status
}

export interface Tag {
  id: string;
  label: string;
  category?: string;
}

export interface DropFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  storagePath: string;
  uploadedBy: string;
  uploadedAt: number;
}

export interface Notification {
  id: string;
  userId: string; // The receiver
  type: 'COMMENT' | 'MENTION' | 'LIKE' | 'VERIFIED' | 'BADGE';
  message: string;
  read: boolean;
  timestamp: number;
  postId?: string; // Context
  postTitle?: string;
  triggerUser: string; // Who triggered it
}

export enum Tab {
  HOME = 'HOME',
  EXPLORE = 'EXPLORE',
  PROFILE = 'PROFILE',
  NEW_POST = 'NEW_POST',
  DROP_LIBRARY = 'DROP_LIBRARY', 
  AI_CHAT = 'AI_CHAT',
  HELP = 'HELP' 
}

export interface AppState {
  currentUser: User;
  posts: Post[];
  dropFiles: DropFile[]; 
  availableTags: string[];
  notifications: Notification[]; 
  activeTab: Tab;
}