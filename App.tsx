
import React, { useState, useEffect, useRef } from "react";

import {
  Home, Search, User as UserIcon, PlusSquare, Bot, Menu, X,
  Image as ImageIcon, Send, LogOut, ThumbsUp, MoreVertical, Key,
  Trash2, AlertTriangle, MessageCircle, HelpCircle, FolderOpen,
  UploadCloud, FileText, Download, ArrowUp, ArrowDown, Paperclip,
  Mic, Bell, Check, CheckCircle, Award, ShieldCheck, Zap, Star, Users
} from 'lucide-react';

import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from "firebase/auth";

import {
  doc, updateDoc, collection, addDoc, getDoc, query, orderBy, deleteDoc, onSnapshot
} from "firebase/firestore";

import { ref, deleteObject } from "firebase/storage";

import { db, storage, logout } from "./services/firebase";
import { addComment } from "./services/commentsService";
import { fetchPosts, createPost } from "./services/postService";
import { likePost, unlikePost, hasUserLiked } from "./services/likesService";
import {
  createUserNotification, fetchUserNotifications,
  markNotificationAsRead, deleteAllUserNotifications
} from "./services/notificationsService";
import {
  createHelpMessage, fetchHelpMessages,
  markHelpAsRead, deleteHelpMessage, HelpMessage
} from "./services/helpService";
import { uploadFile } from "./services/storageService";
import { RichTextEditor } from './components/RichTextEditor';
import { useAuth } from "./auth/AuthContext";
import Login from "./auth/Login";

import { User, Post, Tab, AppState, DropFile, Notification, UserRole, Badge } from './types';
import { INITIAL_TAGS, BADGES } from './constants';


// --- Sub-Components ---

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: React.ElementType, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    <Icon size={18} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const UserAvatar = ({ user, size = 'md' }: { user: { initials: string, color: string }, size?: 'xs' | 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-24 h-24 text-2xl'
  };
  
  return (
    <div className={`${sizeClasses[size]} ${user.color} rounded-full flex items-center justify-center text-white font-bold shadow-sm border-2 border-white box-content`}>
      {user.initials}
    </div>
  );
};

// Helper for rendering badges
const BadgeIcon = ({ name }: { name: string }) => {
  switch(name) {
    case 'shield': return <ShieldCheck size={12} />;
    case 'fiber_manual_record': return <Zap size={12} />;
    case 'school': return <Award size={12} />;
    case 'star': return <Star size={12} />;
    default: return <Award size={12} />;
  }
};

const SearchBar = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
  <div className="relative w-full">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <Search className="text-gray-400" size={20} />
    </div>
    <input
      type="text"
      className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition duration-150 ease-in-out text-gray-900"
      placeholder="Buscar en posts, autores o tags..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
      >
        <X size={18} />
      </button>
    )}
  </div>
);

// --- Voice Recognition Hook Helper ---
const useSpeechRecognition = (onResult: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.start();
  };

  return { isListening, startListening };
};

interface PostCardProps {
  post: Post;
  currentUser: User;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onTagClick?: (tag: string) => void;
  onComment: (postId: string, text: string) => void;
  onVerify: (postId: string) => void;
  id?: string;
}


const PostCard: React.FC<PostCardProps> = ({ post, currentUser, onDelete, isAdmin, onTagClick, onComment, onVerify, id }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [liveComments, setLiveComments] = useState(post.comments);
  const [liveLikes, setLiveLikes] = useState(post.likes);

  const { isListening, startListening } = useSpeechRecognition((text) => {
    setCommentText(prev => prev + " " + text);
  });

  // Sincronizar cuando el post padre cambia (onSnapshot del padre)
  useEffect(() => {
    setLiveComments(post.comments);
    setLiveLikes(post.likes);
  }, [post.comments, post.likes]);

  // Comentarios en tiempo real via onSnapshot de la subcolección
  useEffect(() => {
    const ref = collection(db, "posts", post.id, "comments");
    const q = query(ref, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const comments = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setLiveComments(comments);
    });
    return () => unsub();
  }, [post.id]);

  // Likes en tiempo real via onSnapshot del documento del post
  useEffect(() => {
    const postRef = doc(db, "posts", post.id);
    const unsub = onSnapshot(postRef, (snap) => {
      if (snap.exists()) setLiveLikes(snap.data().likes ?? 0);
    });
    return () => unsub();
  }, [post.id]);

  useEffect(() => {
    if (!currentUser) return;
    hasUserLiked(post.id, currentUser.id).then(setIsLiked);
  }, []);

  


  const handleLike = async () => {
  if (!currentUser) return;

  const userId = currentUser.id;

  if (isLiked) {
    await unlikePost(post.id, userId);
    setIsLiked(false);
  } else {
    await likePost(post.id, userId);
    setIsLiked(true);

    // 🔔 Notificación de LIKE
    if (post.authorId !== userId) {
      await createUserNotification(post.authorId, {
        type: "LIKE",
        message: "Le dieron like a tu post",
        postId: post.id,
        read: false,
        timestamp: Date.now(),
        triggerUser: currentUser.initials
      });
    }
  }

  };





  const handleSendComment = () => {
    if (commentText.trim()) {
      onComment(post.id, commentText);
      setCommentText('');
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${dateStr} ${timeStr}`;
  };

  return (
    <div 
      id={id} 
      className={`bg-white rounded-xl p-5 shadow-sm border mb-4 transition-all hover:shadow-md relative scroll-mt-24 ${
        post.isVerified ? 'border-green-300 ring-1 ring-green-100' : 'border-gray-100'
      }`}
    >
      {/* Verified Banner */}
      {post.isVerified && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-green-50 to-white h-1.5 rounded-t-xl"></div>
        )}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${post.authorColor} rounded-full flex items-center justify-center text-white text-sm font-bold relative`}>
            {post.authorInitials}
            {post.isVerified && (
               <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                   <CheckCircle size={14} className="text-green-500 fill-green-100" />
               </div>
            )}

          </div>
          <div>
            <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{post.authorName}</h3>
                {post.authorBadges && post.authorBadges.map(badge => (
                    <div key={badge.id} title={badge.name} className={`${badge.color} p-0.5 rounded-md flex items-center justify-center`}>
                        <BadgeIcon name={badge.icon} />
                    </div>
                ))}
            </div>
            
            <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">{formatDate(post.timestamp)}</p>
                {post.isVerified && (
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 flex items-center gap-1">
                        <Check size={10} /> SOLUCIÓN VERIFICADA
                    </span>
                )}

                  


            </div>
          </div>
        </div>

        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <MoreVertical size={20} />
          </button>
          
          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-10 cursor-default" 
                onClick={() => setIsMenuOpen(false)}
              ></div>
              <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-20 py-1 overflow-hidden">
                {/* Supervisor Action */}
                {isAdmin && (
                   <button
                     onClick={() => {
                        setIsMenuOpen(false);
                        onVerify(post.id);
                     }}
                     className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2 transition-colors border-b border-gray-50"
                   >
                     <ShieldCheck size={16} />
                     {post.isVerified ? 'Quitar Verificado' : 'Verificar Solución'}
                   </button>
                )}

                {currentUser.id === post.authorId || isAdmin ? (
                   <button
                     onClick={() => {
                       setIsMenuOpen(false);
                       onDelete(post.id);
                     }}
                     className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                   >
                     <Trash2 size={16} />
                     Eliminar Post
                   </button>
                ) : (
                   <button 
                     className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50 cursor-not-allowed flex items-center gap-2"
                     disabled
                   >
                     <AlertTriangle size={16} />
                     Reportar
                   </button>
                )}

              </div>
            </>
          )}
        </div>
      </div>
      
      
      {/* Title */}
      <h2 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h2>
      
      {/* Content */}
      <div 
        className="text-gray-800 mb-4 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: (() => {
          // Sanitización básica: elimina scripts, eventos inline y iframes
          return (post.content || '')
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
            .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
            .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/javascript:/gi, '');
        })() }}
      />

      {post.imageUrl && (
        <div className="mb-4 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
          <img src={post.imageUrl} alt="Post attachment" className="w-full h-auto object-cover max-h-96" />
        </div>
      )}

      {post.attachmentUrl && post.attachmentName && (
        <a
          href={post.attachmentUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors group"
        >
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            <FileText size={18} className="text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-700 truncate">{post.attachmentName}</p>
            <p className="text-xs text-blue-400">Toca para abrir</p>
          </div>
          <Download size={16} className="text-blue-300 group-hover:text-blue-500 flex-shrink-0" />
        </a>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {post.tags.map(tag => (
          <button 
            key={tag} 
            onClick={() => onTagClick && onTagClick(tag)}
            className={`text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full transition-colors ${onTagClick ? 'hover:bg-blue-100 cursor-pointer' : ''}`}
          >
            #{tag}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-6 pt-3 border-t border-gray-50 text-gray-500">
        <button 
          onClick={handleLike}
          className={`flex items-center gap-2 transition-all duration-200 group ${
            isLiked ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
          }`}
        >
          <div className={`transition-transform duration-300 ${isLikeAnimating ? 'scale-150' : 'scale-100'}`}>
            <ThumbsUp 
              size={18} 
              fill={isLiked ? "currentColor" : "none"} 
              className={isLiked ? "text-blue-600" : ""}
            />
          </div>
          <span className="text-sm font-medium">{liveLikes} Likes</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 transition-colors ${showComments ? 'text-blue-600' : 'hover:text-blue-600'}`}
        >
          <MessageCircle size={18} />
          <span className="text-sm font-medium">Comentar ({liveComments.length})</span>
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-4 mb-4">
            {liveComments.length > 0 ? (
              liveComments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <UserAvatar 
                      user={{ initials: comment.authorInitials, color: comment.authorColor }} 
                      size="xs" 
                    />
                  </div>
                  <div className="bg-gray-50 rounded-2xl rounded-tl-none px-4 py-2 flex-1">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-bold text-gray-900">{comment.authorName}</span>
                      <span className="text-[10px] text-gray-400">{formatDate(comment.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-gray-400 py-2 italic">Sé el primero en comentar</p>
            )}
          </div>

          <div className="flex gap-2 items-end">
            <UserAvatar user={currentUser} size="xs" />
            <div className="flex-1 relative">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Escribe un comentario... (@usuario para mencionar)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-gray-50 focus:bg-white pr-10"
                rows={1}
                style={{ minHeight: '38px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendComment();
                  }
                }}
              />
              <button
                onClick={startListening}
                className={`absolute right-2 bottom-1.5 p-1 rounded-full transition-colors ${isListening ? 'text-red-600 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}
                title="Dictar voz"
              >
                <Mic size={16} />
              </button>
            </div>
            <button 
              onClick={handleSendComment}
              disabled={!commentText.trim()}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Admins gestionados via Firestore (colección "admins")

// 🏅 Badges por participación (cantidad de posts creados)
const POST_BADGES = [
  { min: 5,  name: "Madera",   icon: "award", color: "bg-amber-200", description: "5 posts creados" },
  { min: 10, name: "Hierro",   icon: "shield", color: "bg-gray-300", description: "10 posts creados" },
  { min: 30, name: "Plata",    icon: "star", color: "bg-slate-300", description: "30 posts creados" },
  { min: 50, name: "Oro",      icon: "star", color: "bg-yellow-300", description: "50 posts creados" },
  { min: 100,name: "Platino",  icon: "shield", color: "bg-indigo-300", description: "100 posts creados" }
];

const getPostBadgeForUser = (postCount: number): Badge[] => {
  const earned = POST_BADGES
    .filter(b => postCount >= b.min)
    .slice(-1); // solo el badge más alto

  return earned.map((b, index) => ({
    id: `post-${b.min}`,
    name: b.name,
    icon: b.icon,
    color: b.color,
    description: b.description
  }));
};





// --- Main App ---

export default function App() {
  // 🔥 Firebase Auth
const { user: firebaseUser, loading } = useAuth();

// 🔹 STATE PRINCIPAL
const [state, setState] = useState<AppState>({
  currentUser: {} as User,
  posts: [],
  dropFiles: [],
  availableTags: INITIAL_TAGS,
  notifications: [],
  activeTab: Tab.HOME
});

// 🔹 UI STATE
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

const [showNotifications, setShowNotifications] = useState(false);

// 🔹 SEARCH / FILTER
const [searchTerm, setSearchTerm] = useState('');
const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);

// 🔹 HELP
const [helpQuery, setHelpQuery] = useState('');
const [helpMessages, setHelpMessages] = useState<HelpMessage[]>([]);

// 🔹 PROFILE
const [oldPassword, setOldPassword] = useState('');
const [newPassword, setNewPassword] = useState('');

// 🔹 DELETE
const [postToDelete, setPostToDelete] = useState<string | null>(null);

// 🔹 CHAT
const chatFileInputRef = useRef<HTMLInputElement>(null);

// Voice Chat (temporalmente desactivado)
const isChatListening = false;
const startChatListening = () => {};

// New Post State
  
  
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTags, setNewPostTags] = useState<string[]>([]);
  const [newPostImage, setNewPostImage] = useState<File | null>(null); // imagen inline en editor
  const [newPostAttachment, setNewPostAttachment] = useState<File | null>(null); // archivo adjunto
  const [isUploading, setIsUploading] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);

  // Drop Library Sort State
  const [sortConfig, setSortConfig] = useState<{ key: 'uploadedAt' | 'size' | 'type'; direction: 'asc' | 'desc' }>({ key: 'uploadedAt', direction: 'desc' });
  const [libSearch, setLibSearch] = useState('');
  const [libCategory, setLibCategory] = useState<string | null>(null);
  const [libUploadDesc, setLibUploadDesc] = useState('');
  const [libUploadCat, setLibUploadCat] = useState('General');
  const [libPreview, setLibPreview] = useState<DropFile | null>(null);

  

  // AI Chat State
  // --- Buscador potente ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string, imageUrl?: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatImage, setChatImage] = useState<File | null>(null);
  const [isChatThinking, setIsChatThinking] = useState(false);
  
  




const userEmail = firebaseUser?.email ?? '';
const [isAdmin, setIsAdmin] = useState(false);


const isPasswordUser =
  firebaseUser?.providerData?.some(
    provider => provider.providerId === 'password'
  ) ?? false;

// 🔐 Verificar si el usuario es admin consultando Firestore
useEffect(() => {
  if (!firebaseUser) {
    setIsAdmin(false);
    return;
  }
  const adminRef = doc(db, "admins", firebaseUser.uid);
  getDoc(adminRef).then(snap => setIsAdmin(snap.exists())).catch(() => setIsAdmin(false));
}, [firebaseUser]);



const getResolvedUserName = () => {
  if (!firebaseUser) return 'Usuario';

  return (
    firebaseUser?.displayName ||
    firebaseUser?.providerData?.[0]?.displayName ||
    firebaseUser?.email?.split('@')[0] ||
    'Usuario'
  );
};


const getResolvedUserInitials = () => {
  const name = getResolvedUserName();
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};



useEffect(() => {
  const currentUser: User = {
    id: firebaseUser?.uid,
    name: getResolvedUserName(),
    email: firebaseUser?.email || '',
    initials: getResolvedUserInitials(),
    color: 'bg-blue-500',
    role: UserRole.USER,
    photoURL: firebaseUser?.photoURL || undefined,
    badges: []
  };

  setState(prev => ({ ...prev, currentUser }));
}, [firebaseUser]);





useEffect(() => {
  if (!firebaseUser) return;

  const q = query(collection(db, "library"), orderBy("uploadedAt", "desc"));
  const unsub = onSnapshot(q, (snap) => {
    const files: DropFile[] = snap.docs.map((docSnap) => {
      const data = docSnap.data() as any;
      return {
        id: docSnap.id,
        name: data.name,
        description: data.description || null,
        category: data.category || 'General',
        size: data.size,
        type: data.type,
        url: data.url,
        storagePath: data.storagePath,
        uploadedBy: data.uploadedBy,
        uploadedAt: data.uploadedAt,
        downloads: data.downloads || 0,
      };
    });
    setState((prev) => ({ ...prev, dropFiles: files }));
  }, (err) => console.error("Error biblioteca:", err));

  return () => unsub();
}, [firebaseUser]);





  
  




  

  
 
  




  


  

  const handleVerifyPost = async (postId: string) => {
  try {
    const postRef = doc(db, "posts", postId);

    const post = state.posts.find(p => p.id === postId);
    if (!post) return;

    const newValue = !post.isVerified;

    await updateDoc(postRef, {
      isVerified: newValue,
      verifiedAt: newValue ? Date.now() : null
    });

    setState(prev => ({
      ...prev,
      posts: prev.posts.map(p =>
        p.id === postId ? { ...p, isVerified: newValue } : p
      )
    }));
  } catch (err) {
    console.error("Error verificando post", err);
  }
};

    // 🔥 Posts en tiempo real con onSnapshot
  useEffect(() => {
  if (!firebaseUser) return;

  const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
  const unsub = onSnapshot(q, (snap) => {
    const postsFromDb: Post[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data.title || "",
          authorId: data.authorId || "",
          authorName: data.authorName || "",
          authorInitials: data.authorInitials || "",
          authorColor: data.authorColor || "",
          authorBadges: data.authorBadges || [],
          content: data.content || "",
          imageUrl: data.imageUrl || null,
          attachmentUrl: data.attachmentUrl || null,
          attachmentName: data.attachmentName || null,
          tags: data.tags || [],
          likes: data.likes || 0,
          comments: [], // comentarios cargados en tiempo real por cada PostCard
          timestamp: data.timestamp || Date.now(),
          isVerified: data.isVerified ?? false,
        };
      });

    const myPostsCount = postsFromDb.filter(p => p.authorId === firebaseUser.uid).length;
    const badges = getPostBadgeForUser(myPostsCount);
    const derivedTags = Array.from(new Set(postsFromDb.flatMap(p => p.tags || []))).sort();

    setState(prev => ({
      ...prev,
      posts: postsFromDb,
      availableTags: derivedTags,
      currentUser: { ...prev.currentUser, badges }
    }));
  }, (err) => console.error("Error cargando posts:", err));

  return () => unsub();
  }, [firebaseUser]);


  useEffect(() => {
  if (!isAdmin) return;

  const loadHelp = async () => {
    try {
      const data = await fetchHelpMessages();
      setHelpMessages(data);
    } catch (e) {
      console.error("Error cargando mensajes de ayuda", e);
    }
  };

  loadHelp();
  }, [isAdmin]);


  

  // 🔔 Notificaciones en tiempo real con onSnapshot
useEffect(() => {
  if (!firebaseUser) return;

  const ref = collection(db, "users", firebaseUser.uid, "notifications");
  const q = query(ref, orderBy("timestamp", "desc"));
  const unsub = onSnapshot(q, (snap) => {
    const notifs: Notification[] = snap.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        userId: data.userId,
        type: data.type,
        message: data.message,
        read: !!data.read,
        timestamp: data.timestamp ?? Date.now(),
        postId: data.postId,
        postTitle: data.postTitle,
        triggerUser: data.triggerUser,
      };
    });
    setState(prev => ({ ...prev, notifications: notifs }));
  }, (err) => console.error("Error notificaciones:", err));

  return () => unsub();
}, [firebaseUser]);




  
  
 




  


   

  

  // --- Handlers ---

  // Upload de imagen inline en el editor
  const handleEditorImageUpload = async (file: File): Promise<string> => {
    const storagePath = `posts/inline/${state.currentUser.id}/${Date.now()}_${file.name}`;
    return await uploadFile(file, storagePath);
  };

  const handleCreatePost = async () => {
  if (!newPostContent.trim() || !newPostTitle.trim()) return;
  if (newPostTags.length === 0) {
    alert("Por favor selecciona al menos un Hashtag.");
    return;
  }

  setIsUploading(true);

  try {
    let imageUrl: string | null = null;
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;

    // Subir archivo adjunto si existe
    if (newPostAttachment) {
      const storagePath = `attachments/${state.currentUser.id}/${Date.now()}_${newPostAttachment.name}`;
      attachmentUrl = await uploadFile(newPostAttachment, storagePath);
      attachmentName = newPostAttachment.name;
    }

    // 🔥 ARMAR EL POST SIN ID
    const postWithoutId: Omit<Post, "id"> = {
      title: newPostTitle,
      authorId: state.currentUser.id,
      authorName: state.currentUser.name,
      authorInitials: state.currentUser.initials,
      authorColor: state.currentUser.color,
      authorBadges: state.currentUser.badges,
      content: newPostContent,
      tags: newPostTags,
      likes: 0,
      comments: [],
      timestamp: Date.now(),
      imageUrl: imageUrl,
      attachmentUrl: attachmentUrl,
      attachmentName: attachmentName,
    };

    // 🔥 GUARDAR EN FIRESTORE
    const postId = await createPost(postWithoutId);

    // 🔥 ACTUALIZAR ESTADO LOCAL
    setState((prev) => ({
      ...prev,
      posts: [{ ...postWithoutId, id: postId }, ...prev.posts],
      activeTab: Tab.HOME,
    }));

    // 🔥 LIMPIAR FORMULARIO
    setNewPostTitle("");
    setNewPostContent("");
    setNewPostTags([]);
    setNewPostImage(null);
    setNewPostAttachment(null);

  } catch (err) {
    console.error("Error creando post en Firestore", err);
    alert("Error publicando el post.");
  } finally {
    setIsUploading(false);
  }
};






    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsUploading(true);
    try {
      const storagePath = `library/${Date.now()}_${file.name}`;
      const url = await uploadFile(file, storagePath);
      await addDoc(collection(db, "library"), {
        name: file.name,
        description: libUploadDesc.trim() || null,
        category: libUploadCat || "General",
        size: file.size,
        type: file.type,
        url,
        storagePath,
        uploadedBy: state.currentUser.name,
        uploadedAt: Date.now(),
        downloads: 0,
      });
      setLibUploadDesc('');
      setLibUploadCat('General');
    } catch (err) {
      console.error("Error subiendo archivo", err);
      alert("Error subiendo archivo. Verificá los permisos de Firebase Storage.");
    } finally {
      setIsUploading(false);
    }
  };


  const handleSort = (key: 'uploadedAt' | 'size' | 'type') => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

// Manejo centralizado del Like

const handleAddComment = async (postId: string, text: string) => {
  const post = state.posts.find(p => p.id === postId);
  if (!post || !firebaseUser) return;

  const resolvedName =
    firebaseUser?.displayName ||
    firebaseUser?.providerData?.[0]?.displayName ||
    firebaseUser?.email?.split("@")[0] ||
    "Usuario";

  const resolvedInitials = resolvedName
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const newCommentForFirestore = {
    authorId: firebaseUser?.uid,
    authorName: resolvedName,
    authorInitials: resolvedInitials,
    authorColor: state.currentUser.color,
    content: text,
    timestamp: Date.now()
  };

  const commentId = await addComment(postId, newCommentForFirestore);

  const newCommentLocal = {
    id: commentId,
    ...newCommentForFirestore
  };

  // 🔄 Estado local SOLO para comentarios
  setState(prev => ({
    ...prev,
    posts: prev.posts.map(p =>
      p.id === postId
        ? { ...p, comments: [...p.comments, newCommentLocal] }
        : p
    )
  }));

  // 🔔 Persistir notificación
  if (post.authorId !== firebaseUser?.uid) {
    await createUserNotification(post.authorId, {
      type: "COMMENT",
      message: "Han comentado tu post",
      postId: post.id,
      read: false,
      timestamp: Date.now(),
      triggerUser: resolvedInitials
    });
  }
};







  const handleMarkNotificationRead = (id: string) => {
    setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => n.id === id ? { ...n, read: true } : n)
    }));
  };

  const handleMarkAllRead = () => {
    setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => ({ ...n, read: true }))
    }));
  };

  const handleDeleteAllNotifications = async () => {
  if (!firebaseUser) return;

  await deleteAllUserNotifications(firebaseUser.uid);

  setState(prev => ({
    ...prev,
    notifications: []
  }));

  setShowNotifications(false);
};


  const handleNotificationClick = async (notif: Notification) => {
  try {
    // 1️⃣ marcar como leída en Firestore
    if (!notif.read && firebaseUser) {
      await markNotificationAsRead(firebaseUser?.uid, notif.id);
    }

    // 2️⃣ actualizar estado local
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === notif.id ? { ...n, read: true } : n
      )
    }));

    // 3️⃣ cerrar dropdown
    setShowNotifications(false);

    // 4️⃣ ir al post
    if (notif.postId) {
      setState(prev => ({ ...prev, activeTab: Tab.HOME }));
      setTimeout(() => {
        document
          .getElementById(`post-${notif.postId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }

  } catch (err) {
    console.error("Error manejando notificación", err);
  }
 };


  const handleAddTag = (tag: string) => {
    if (newPostTags.includes(tag)) {
      setNewPostTags(prev => prev.filter(t => t !== tag));
    } else {
      setNewPostTags(prev => [...prev, tag]);
    }
  };

  const handleAddCustomTag = () => {
    if (customTag && !state.availableTags.includes(customTag)) {
      setState(prev => ({
        ...prev,
        availableTags: [...prev.availableTags, customTag]
      }));
      setNewPostTags(prev => [...prev, customTag]);
      setCustomTag('');
      setShowCustomTagInput(false);
    }
  };

  const handleAIChat = async () => {
  if (!chatInput.trim() && !chatImage) return;

  const userMsg = chatInput;
  let imageBase64: string | null = null;
  let imagePreviewUrl: string | undefined = undefined;

  // Convertir imagen a base64 si existe
  if (chatImage) {
    imagePreviewUrl = URL.createObjectURL(chatImage);
    imageBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Sacar el prefijo "data:image/jpeg;base64,"
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(chatImage);
    });
  }

  setChatMessages(prev => [...prev, { 
    role: 'user', 
    text: userMsg || '📷 Imagen adjunta', 
    imageUrl: imagePreviewUrl 
  }]);
  setChatInput('');
  setChatImage(null);
  setIsChatThinking(true);

  try {
    const res = await fetch(
      `${import.meta.env.VITE_AGENT_URL}/api/ask`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: userMsg || "¿Qué ves en esta imagen?",
          image: imageBase64 || null
        })
      }
    );

    if (!res.ok) throw new Error("Error del agente IA");

    const data = await res.json();
    setChatMessages(prev => [...prev, { role: 'model', text: data.answer }]);
  } catch (error) {
    console.error(error);
    setChatMessages(prev => [...prev, { role: 'model', text: "Error de conexión con el Agente IA." }]);
  } finally {
    setIsChatThinking(false);
  }
};



  const handleChatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setChatImage(e.target.files[0]);
      }
  };

  
const handleSmartTag = async () => {
  if (!newPostContent.trim()) return;

  try {
    // Llamamos al backend IA
    const res = await fetch(`${import.meta.env.VITE_AGENT_URL}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: `Sugerime SOLO hashtags (de esta lista) para este post. 
Lista permitida: ${state.availableTags.join(", ")}.
Devolvé únicamente una lista separada por comas, sin explicación.
Texto del post: ${newPostContent}`
      })
    });

    if (!res.ok) throw new Error("Error sugiriendo tags");

    const data = await res.json();
    const answerText: string = data.answer || "";

    // Parse simple: extraer tags por comas / saltos
    const raw = answerText
      .replace(/📘[\s\S]*?🌐/g, "") // por si el formato trae secciones
      .replace(/[^\w\s,#áéíóúüñÁÉÍÓÚÜÑ-]/g, " "); // limpia raros

    const suggested = raw
      .split(/[,|\n]/)
      .map(t => t.trim())
      .filter(Boolean);

    // Aplicar solo los que existen en availableTags
    const valid = suggested.filter(tag => state.availableTags.includes(tag));

    // Si no encontró nada, avisar
    if (valid.length === 0) {
      alert("No pude sugerir tags. Probá escribir un poco más o agregá tags relevantes.");
      return;
    }

    // Activar tags sugeridos
    valid.forEach(tag => {
      if (!newPostTags.includes(tag)) {
        handleAddTag(tag);
      }
    });

  } catch (err) {
    console.error(err);
    alert("No se pudo sugerir tags con IA (backend).");
  }
};




  const handleChangePassword = async () => {
  if (!firebaseUser?.email) return;
  try {
    const credential = EmailAuthProvider.credential(
      firebaseUser?.email,
      oldPassword
    );
    await reauthenticateWithCredential(firebaseUser, credential);
    await updatePassword(firebaseUser, newPassword);
    alert("Contraseña actualizada correctamente");
    setOldPassword("");
    setNewPassword("");
  } catch (err: any) {
    alert("Error al cambiar contraseña: " + err.message);
  }
};

  const handleDeleteRequest = (postId: string) => {
    setPostToDelete(postId);
  };

  const confirmDelete = async () => {
  if (!postToDelete) return;

  try {
    await deleteDoc(doc(db, "posts", postToDelete));
    setState(prev => ({
      ...prev,
      posts: prev.posts.filter(p => p.id !== postToDelete)
    }));
  } catch (err) {
    console.error("Error borrando post:", err);
    alert("No se pudo borrar el post.");
  } finally {
    setPostToDelete(null);
  }
};



  


  


  const handleTagClick = (tag: string) => {
    setActiveFilterTag(tag);
    setState(prev => ({ ...prev, activeTab: Tab.EXPLORE }));
  };

  const handleSendHelp = async () => {
  if (!helpQuery.trim()) return;

  try {
    await createHelpMessage(helpQuery.trim());
    setHelpQuery("");
    alert("Mensaje enviado de forma anónima ✅");
  } catch (err) {
    console.error("Error enviando ayuda", err);
    alert("No se pudo enviar el mensaje");
  }
  };

  const handleDownload = async (file: DropFile) => {
    // Incrementar contador de descargas
    try {
      await updateDoc(doc(db, "library", file.id), {
        downloads: (file.downloads || 0) + 1
      });
    } catch {}
    window.open(file.url, '_blank');
  };

  const handleDeleteDropFile = async (file: DropFile) => {
  if (!isAdmin) return;

  const ok = confirm(`¿Borrar "${file.name}"?`);
  if (!ok) return;

  try {
    // Borrar de Storage solo si tiene storagePath (archivos viejos pueden no tenerlo)
    if (file.storagePath) {
      try {
        await deleteObject(ref(storage, file.storagePath));
      } catch (storageErr: any) {
        // Si el archivo no existe en storage, ignoramos y seguimos
        if (storageErr.code !== 'storage/object-not-found') throw storageErr;
      }
    }
    // Borrar metadata de Firestore — onSnapshot actualiza la lista automáticamente
    await deleteDoc(doc(db, "library", file.id));
  } catch (err) {
    console.error("Error borrando archivo:", err);
    alert("No se pudo borrar el archivo.");
  }
};



  




  const handleLogout = async () => {
    try {
      await logout();        // llama al signOut de Firebase
      // No hace falta hacer más nada:
      // onAuthStateChanged va a poner firebaseUser en null
      // y tu App va a mostrar <Login />
    } catch (err) {
      console.error("Error en logout", err);
    }
  };


  



const isGoogleUser =
  firebaseUser?.providerData?.some(
    p => p.providerId === 'google.com'
  ) ?? false;


const unreadNotifications = state.notifications.filter(n => !n.read).length;

  const NotificationDropdown = () => (
      <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-semibold text-gray-800">Notificaciones</h3>

                <div className="flex gap-3">
                  {unreadNotifications > 0 && (
                    <button 
                      onClick={handleMarkAllRead}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Marcar todas
                    </button>
                  )}

                  {state.notifications.length > 0 && (
                    <button
                      onClick={handleDeleteAllNotifications}

                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Eliminar todas
                    </button>
                  )}
                </div>
</div>

          <div className="max-h-80 overflow-y-auto">
              {state.notifications.length > 0 ? (
                  state.notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors flex gap-3 ${!notif.read ? 'bg-blue-50/50' : ''}`}
                      >
                         <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                             {notif.type === 'VERIFIED' ? <ShieldCheck size={14} /> : notif.triggerUser}
                         </div>
                         <div className="flex-1">
                             <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                                 {notif.message}
                             </p>
                             <p className="text-xs text-gray-400 mt-1">
                                 {new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                             </p>
                         </div>
                         {!notif.read && (
                             <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                         )}
                      </div>
                  ))
              ) : (
                  <div className="p-8 text-center text-gray-400">
                      <Bell size={24} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Sin notificaciones</p>
                  </div>
              )}
          </div>
          

      </div>
  );

  // --- Render Views ---

  const renderHome = () => {
  const filteredPosts = state.posts.filter(post => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;

    return post.content.toLowerCase().includes(term) ||
           post.title.toLowerCase().includes(term) ||
           post.authorName.toLowerCase().includes(term) ||
           post.tags.some(t => t.toLowerCase().includes(term));
  });

  // 👇 AGREGAR ESTO
  const orderedPosts = [...filteredPosts].sort((a, b) => b.timestamp - a.timestamp);

  


  return (
    <div className="max-w-2xl mx-auto pb-20 md:pb-0">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Home</h1>
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
      </header>

      {orderedPosts.length > 0 ? (
        orderedPosts.map(post => (
          <PostCard 
            key={post.id}
            id={`post-${post.id}`}
            post={post}
            currentUser={state.currentUser}
            isAdmin={isAdmin}
            onDelete={handleDeleteRequest}
            onTagClick={handleTagClick}
            onComment={handleAddComment}
            onVerify={handleVerifyPost}


          />
        ))
      ) : (
        <div className="text-center py-10 text-gray-500">
          <p>No se encontraron resultados.</p>
        </div>
      )}
    </div>
  );
};


  // --- Función de scoring para búsqueda potente ---
  const scorePost = (post: Post, term: string): number => {
    if (!term) return 1;
    const t = term.toLowerCase();
    let score = 0;
    if (post.title?.toLowerCase().includes(t)) score += 10;
    if (post.tags?.some(tag => tag.toLowerCase().includes(t))) score += 7;
    if (post.authorName?.toLowerCase().includes(t)) score += 4;
    const plainContent = (post.content || '').replace(/<[^>]*>/g, '').toLowerCase();
    if (plainContent.includes(t)) score += 2;
    // bonus si empieza con el término
    if (post.title?.toLowerCase().startsWith(t)) score += 5;
    return score;
  };

  const highlightText = (text: string, term: string): string => {
    if (!term || !text) return text;
      const escaped = term.replace(/[.*+?^${}()|\[\]\\]/g, '\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
  };

  const renderExplore = () => {
    const term = searchQuery.trim();

    // Filtrar posts con score
    const scoredPosts = state.posts
      .map(post => ({ post, score: scorePost(post, term) }))
      .filter(({ score, post }) => {
        if (!term) return true;
        if (score === 0) return false;
        if (activeFilterTag && !post.tags.includes(activeFilterTag)) return false;
        return true;
      })
      .filter(({ post }) => activeFilterTag ? post.tags.includes(activeFilterTag) : true)
      .sort((a, b) => term ? b.score - a.score : b.post.timestamp - a.post.timestamp)
      .map(({ post }) => post);

    // Filtrar archivos de biblioteca
    const matchingFiles = term ? state.dropFiles.filter(f =>
      f.name.toLowerCase().includes(term.toLowerCase())
    ) : [];

    const goToAI = () => {
      setChatInput(term);
      setState(prev => ({ ...prev, activeTab: Tab.AI_CHAT }));
    };

    return (
      <div className="max-w-2xl mx-auto pb-20 md:pb-0">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Explorar</h1>

        {/* Buscador principal */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="text-gray-400" size={20} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder="Buscar posts, documentos, tags, autores..."
            className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 focus:border-blue-500 rounded-2xl bg-white shadow-sm focus:outline-none text-gray-900 placeholder-gray-400 transition-all"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tags */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveFilterTag(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilterTag === null
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              Todos
            </button>
            {state.availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveFilterTag(activeFilterTag === tag ? null : tag)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeFilterTag === tag
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Resultados de biblioteca si hay búsqueda */}
        {matchingFiles.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FolderOpen size={14} /> Documentos ({matchingFiles.length})
            </h2>
            <div className="space-y-2">
              {matchingFiles.map(file => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-300 hover:shadow transition-all"
                >
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate"
                      dangerouslySetInnerHTML={{ __html: highlightText(file.name, term) }}
                    />
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Download size={16} className="text-gray-300 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Resultados de posts */}
        {term && (
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText size={14} /> Posts ({scoredPosts.length})
          </h2>
        )}

        <div className="space-y-4">
          {scoredPosts.length > 0 ? (
            scoredPosts.map(post => (
              <div key={post.id} className="relative">
                {term && (
                  <div className="absolute -top-1 right-2 z-10">
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                      {post.tags.some(t => t.toLowerCase().includes(term.toLowerCase())) ? '🏷️ tag' :
                       post.title?.toLowerCase().includes(term.toLowerCase()) ? '📌 título' : '📄 contenido'}
                    </span>
                  </div>
                )}
                <PostCard
                  id={`post-${post.id}`}
                  post={post}
                  currentUser={state.currentUser}
                  isAdmin={isAdmin}
                  onDelete={handleDeleteRequest}
                  onTagClick={handleTagClick}
                  onComment={handleAddComment}
                  onVerify={handleVerifyPost}
                />
              </div>
            ))
          ) : (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200">
              <Search className="mx-auto mb-3 text-gray-300" size={36} />
              {term ? (
                <>
                  <p className="text-gray-500 font-medium mb-1">Sin resultados para "{term}"</p>
                  <p className="text-gray-400 text-sm mb-4">Probá con otro término o preguntale a la IA</p>
                  <button
                    onClick={goToAI}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity shadow"
                  >
                    <Bot size={16} />
                    Preguntar a la IA
                  </button>
                </>
              ) : (
                <p className="text-gray-400">Escribí algo para buscar</p>
              )}
            </div>
          )}
        </div>

        {/* Botón IA siempre visible cuando hay búsqueda y hay resultados */}
        {term && scoredPosts.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={goToAI}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity shadow-md"
            >
              <Bot size={16} />
              ¿No encontraste lo que buscabas? Preguntá a la IA
            </button>
          </div>
        )}
      </div>
    );
};


  const renderNewPost = () => (
    <div className="max-w-4xl mx-auto pb-20 md:pb-0">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Nuevo Post</h1>
      
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Título del Post (Obligatorio)</label>
            <input 
                type="text" 
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="Ej: Problemas con acceso a Torre B"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 font-medium"
            />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Contenido</label>
          <RichTextEditor value={newPostContent} onChange={setNewPostContent} onImageUpload={handleEditorImageUpload} />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Archivo adjunto (Opcional)</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors relative">
            <input 
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => setNewPostAttachment(e.target.files ? e.target.files[0] : null)}
            />
            <div className="flex flex-col items-center pointer-events-none">
              <FileText className="text-gray-400 mb-2" size={28} />
              {newPostAttachment ? (
                <span className="text-blue-600 font-medium text-sm">{newPostAttachment.name}</span>
              ) : (
                <span className="text-gray-500 text-sm">PDF, Word, Excel, imágenes, etc.</span>
              )}
            </div>
          </div>
          {newPostAttachment && (
            <button
              onClick={() => setNewPostAttachment(null)}
              className="mt-1 text-xs text-red-500 hover:underline"
            >
              Quitar adjunto
            </button>
          )}
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">Hashtags (Obligatorio)</label>
            <button 
                onClick={handleSmartTag}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                disabled={!newPostContent}
            >
                <Bot size={12} /> Sugerir con IA
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3 max-h-40 overflow-y-auto p-2 border rounded-lg bg-gray-50">
            {state.availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => handleAddTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  newPostTags.includes(tag)
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!showCustomTagInput ? (
               <button 
                 onClick={() => setShowCustomTagInput(true)}
                 className="text-sm text-blue-600 hover:underline flex items-center gap-1"
               >
                 <PlusSquare size={16} /> ¿Nuevo Tag?
               </button>
            ) : (
               <div className="flex items-center gap-2 w-full">
                 <input 
                   type="text" 
                   value={customTag}
                   onChange={(e) => setCustomTag(e.target.value)}
                   placeholder="Nombre del nuevo tag"
                   className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                 />
                 <button 
                   onClick={handleAddCustomTag}
                   className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-bold"
                 >
                   AGREGAR
                 </button>
                 <button 
                   onClick={() => setShowCustomTagInput(false)}
                   className="p-1 text-gray-400"
                 >
                   <X size={16} />
                 </button>
               </div>
            )}
          </div>
        </div>

        <button 
          onClick={handleCreatePost}
          disabled={!newPostContent || !newPostTitle || isUploading || newPostTags.length === 0}
          className={`w-full py-3 rounded-lg font-bold text-white shadow-md flex justify-center items-center gap-2 ${
            !newPostContent || !newPostTitle || isUploading || newPostTags.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isUploading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Publicando...
            </>
          ) : (
            <>
              <Send size={20} /> Publicar
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderDropLibrary = () => {
    const LIB_CATEGORIES = ['General', 'Procedimientos', 'Formularios', 'Normativas', 'Planos', 'Manuales', 'Otros'];

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getFileIcon = (type: string, name: string) => {
      if (type.includes('pdf')) return { bg: 'bg-red-50', color: 'text-red-500', label: 'PDF' };
      if (type.includes('word') || name.endsWith('.docx') || name.endsWith('.doc')) return { bg: 'bg-blue-50', color: 'text-blue-500', label: 'DOC' };
      if (type.includes('excel') || type.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls')) return { bg: 'bg-green-50', color: 'text-green-500', label: 'XLS' };
      if (type.includes('image')) return { bg: 'bg-purple-50', color: 'text-purple-500', label: 'IMG' };
      return { bg: 'bg-gray-100', color: 'text-gray-500', label: 'FILE' };
    };

    const isPreviewable = (file: DropFile) =>
      file.type.includes('image') || file.type.includes('pdf');

    // Filtrar y ordenar
    const filtered = [...state.dropFiles]
      .filter(f => {
        const matchesCat = !libCategory || f.category === libCategory;
        const matchesSearch = !libSearch || f.name.toLowerCase().includes(libSearch.toLowerCase()) || f.description?.toLowerCase().includes(libSearch.toLowerCase());
        return matchesCat && matchesSearch;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortConfig.key === 'size') cmp = a.size - b.size;
        else if (sortConfig.key === 'uploadedAt') cmp = a.uploadedAt - b.uploadedAt;
        else if (sortConfig.key === 'type') cmp = a.type.localeCompare(b.type);
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });

    // Agrupar por categoría si no hay filtro activo
    const grouped = libCategory
      ? { [libCategory]: filtered }
      : filtered.reduce((acc, f) => {
          const cat = f.category || 'General';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(f);
          return acc;
        }, {} as Record<string, DropFile[]>);

    return (
      <div className="max-w-4xl mx-auto pb-20 md:pb-0">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Biblioteca Drop</h1>
          <span className="text-sm text-gray-400">{state.dropFiles.length} archivos</span>
        </div>

        {/* Upload Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <UploadCloud size={16} className="text-blue-500" /> Subir archivo
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={libUploadDesc}
              onChange={e => setLibUploadDesc(e.target.value)}
              placeholder="Descripción (ej: Manual Huawei RRU 2024)"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
            />
            <select
              value={libUploadCat}
              onChange={e => setLibUploadCat(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
            >
              {LIB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="border-2 border-dashed border-blue-200 bg-blue-50/40 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-blue-50 hover:border-blue-300 transition-colors relative">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <div className="bg-white p-2.5 rounded-full shadow-sm mb-2">
              <UploadCloud className="text-blue-500" size={24} />
            </div>
            <p className="font-medium text-gray-700 text-sm">
              {isUploading ? 'Subiendo...' : 'Arrastrá o hacé clic para subir'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, imágenes y más</p>
          </div>
        </div>

        {/* Search + Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              value={libSearch}
              onChange={e => setLibSearch(e.target.value)}
              placeholder="Buscar por nombre o descripción..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
            />
            {libSearch && (
              <button onClick={() => setLibSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setLibCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!libCategory ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              Todos
            </button>
            {LIB_CATEGORIES.map(cat => {
              const count = state.dropFiles.filter(f => (f.category || 'General') === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setLibCategory(libCategory === cat ? null : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${libCategory === cat ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {cat} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort bar */}
        <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
          <span className="font-medium uppercase tracking-wide">Ordenar:</span>
          {(['uploadedAt', 'size', 'type'] as const).map(key => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors font-medium ${sortConfig.key === key ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {key === 'uploadedAt' ? 'Fecha' : key === 'size' ? 'Tamaño' : 'Tipo'}
              {sortConfig.key === key && (sortConfig.direction === 'asc' ? <ArrowUp size={11}/> : <ArrowDown size={11}/>)}
            </button>
          ))}
        </div>

        {/* Files grouped by category */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
            <FolderOpen className="mx-auto mb-3 text-gray-300" size={40} />
            <p className="text-gray-400">{libSearch ? `Sin resultados para "${libSearch}"` : 'La biblioteca está vacía'}</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, files]) => (
            <div key={cat} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat}</span>
                <span className="text-xs text-gray-300">({files.length})</span>
                <div className="flex-1 h-px bg-gray-100 ml-1"></div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {files.map(file => {
                  const icon = getFileIcon(file.type, file.name);
                  return (
                    <div key={file.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-4 flex items-center gap-4 group">
                      {/* Ícono tipo */}
                      <div className={`w-11 h-11 ${icon.bg} rounded-xl flex flex-col items-center justify-center flex-shrink-0`}>
                        <FileText size={18} className={icon.color} />
                        <span className={`text-[9px] font-bold ${icon.color} leading-none mt-0.5`}>{icon.label}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{file.name}</p>
                        {file.description && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{file.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          <span>{formatBytes(file.size)}</span>
                          <span>·</span>
                          <span>{file.uploadedBy}</span>
                          <span>·</span>
                          <span>{new Date(file.uploadedAt).toLocaleDateString('es-AR')}</span>
                          {(file.downloads || 0) > 0 && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Download size={10} /> {file.downloads}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isPreviewable(file) && (
                          <button
                            onClick={() => setLibPreview(file)}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Vista previa"
                          >
                            <CheckCircle size={17} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Descargar"
                        >
                          <Download size={17} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteDropFile(file)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Borrar"
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Modal preview */}
        {libPreview && (
          <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setLibPreview(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <p className="font-medium text-gray-800 truncate flex-1 mr-4">{libPreview.name}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(libPreview)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-blue-700"
                  >
                    <Download size={14} /> Descargar
                  </button>
                  <button onClick={() => setLibPreview(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4">
                {libPreview.type.includes('image') ? (
                  <img src={libPreview.url} alt={libPreview.name} className="max-w-full max-h-full object-contain rounded-lg" />
                ) : (
                  <iframe src={libPreview.url} className="w-full h-full min-h-[60vh] rounded-lg" title={libPreview.name} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };


  const renderAIChat = () => (
    <div className="max-w-2xl mx-auto h-[calc(100vh-80px)] md:h-[calc(100vh-40px)] flex flex-col pb-20 md:pb-0">
       <div className="flex items-center gap-3 mb-4">
         <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white">
           <Bot size={24} />
         </div>
         <div>
           <h1 className="text-xl font-bold text-gray-800">Agente IA WikiMovil</h1>
           <p className="text-xs text-gray-500">Multimodal: Texto y Visión</p>
         </div>
       </div>

       <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
         <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
           {chatMessages.length === 0 && (
             <div className="text-center text-gray-400 mt-10">
               <Bot size={48} className="mx-auto mb-2 opacity-20" />
               <p>Hola {state.currentUser.name.split(' ')[0]}.<br/>Pregúntame sobre procedimientos, reclamos o sube una foto de un equipo.</p>
             </div>
           )}

           {chatMessages.map((msg, idx) => (
             <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                 msg.role === 'user' 
                   ? 'bg-blue-600 text-white rounded-tr-none' 
                   : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
               }`}>
                 {msg.imageUrl && (
                     <div className="mb-2 rounded-lg overflow-hidden">
                         <img src={msg.imageUrl} alt="Uploaded by user" className="max-w-full h-auto" />
                     </div>
                 )}

                 <span className={msg.role === 'user' ? '' : 'text-gray-900'}>{msg.text}</span>
               </div>
             </div>
           ))}
           </div>
           {isChatThinking && (
             <div className="flex justify-start">
               <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                 <div className="flex gap-1">
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                 </div>
               </div>
             </div>
           )}
         </div>
         
         <div className="p-3 bg-white border-t border-gray-100">
           {/* Image Preview in Chat Input */}
           {chatImage && (
             <div className="mb-2 flex items-center gap-2 bg-gray-50 p-2 rounded-lg inline-flex">
                 <div className="w-12 h-12 rounded overflow-hidden relative">
                    <img src={URL.createObjectURL(chatImage)} alt="Preview" className="w-full h-full object-cover"/>
                 </div>
                 <div className="flex flex-col">
                     <span className="text-xs text-gray-600 truncate max-w-[150px]">{chatImage.name}</span>
                     <button onClick={() => setChatImage(null)} className="text-xs text-red-500 hover:underline text-left">Quitar</button>
                 </div>
             </div>
           )}

           <div className="flex gap-2 items-center">
             <input 
                type="file" 
                ref={chatFileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={handleChatImageSelect}
             />
             <button
               onClick={() => chatFileInputRef.current?.click()}
               className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors"
               title="Adjuntar imagen"
             >
                <Paperclip size={20} />
             </button>
             
             <div className="flex-1 relative">
                 <input 
                   type="text" 
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   onKeyPress={(e) => e.key === 'Enter' && handleAIChat()}
                   placeholder="Mensaje o descripción..."
                   className="w-full px-4 py-2 bg-gray-100 text-gray-900 border-0 rounded-full focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-500 pr-10"
                 />
                 <button
                   onClick={startChatListening}
                   className={`absolute right-2 top-1.5 p-1 rounded-full transition-colors ${isChatListening ? 'text-red-600 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}
                   title="Dictar voz"
                 >
                   <Mic size={16} />
                 </button>
             </div>

             <button 
               onClick={handleAIChat}
               disabled={(!chatInput.trim() && !chatImage) || isChatThinking}
               className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50"
             >
               <Send size={20} />
             </button>
           </div>
         </div>
       </div>
     
    
  );

  const renderHelp = () => (
    <div className="max-w-2xl mx-auto pb-20 md:pb-0">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Ayuda y Soporte</h1>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="w-full flex justify-center mb-6">
               <img 
                  src="https://i0.wp.com/geekade.com/wp-content/uploads/2016/07/img-35.png?w=1140&ssl=1" 
                  alt="Soporte" 
                  className="w-full h-auto object-contain"
               />
            </div>

            <p className="text-gray-600 mb-4 text-sm">
                ¿Tienes alguna duda sobre la aplicación o necesitas reportar un problema técnico? 
                Escribe tu consulta abajo y será enviada al equipo de soporte.
            </p>
            
            <textarea
                value={helpQuery}
                onChange={(e) => setHelpQuery(e.target.value)}
                placeholder="Escribe aquí tu consulta..."
                className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-white text-gray-900 mb-4"
            ></textarea>

            <button 
                onClick={handleSendHelp}
                disabled={!helpQuery.trim()}
                className={`w-full py-3 rounded-lg font-bold text-white shadow-md flex justify-center items-center gap-2 ${
                    !helpQuery.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                <Send size={20} /> Enviar Consulta
            </button>
        </div>
    </div>
  );

  

  const renderProfile = () => (
    <div className="max-w-2xl mx-auto pb-20 md:pb-0">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mi Perfil</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 h-32"></div>
        <div className="px-6 pb-6 relative">
          <div className="absolute -top-12 left-6">
             <UserAvatar user={state.currentUser} size="lg" />
          </div>
          <div className="pt-20 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {state.currentUser.name}
                {state.currentUser.role === UserRole.ADMIN && (
                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full font-bold">
                        SUPERVISOR
                    </span>
                )}
            </h2>
            <p className="text-gray-500">{state.currentUser.email}</p>
          </div>

          {/* Badges Section */}
          <div className="border-t border-gray-100 pt-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
              <Award size={20} className="text-yellow-500" /> Mis Logros
            </h3>
            <div className="flex flex-wrap gap-3">
                {state.currentUser.badges.length > 0 ? (
                    state.currentUser.badges.map(badge => (
                        <div key={badge.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${badge.color} border border-opacity-20`}>
                            <BadgeIcon name={badge.icon} />
                            <div>
                                <p className="text-xs font-bold">{badge.name}</p>
                                <p className="text-[10px] opacity-80">{badge.description}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-400 text-sm italic">Aún no tienes insignias.</p>
                )}
            </div>
          </div>

          {isPasswordUser && (
  <div className="border-t border-gray-100 pt-6">
    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
      <Key size={20} /> Seguridad
    </h3>
    <div className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Contraseña Anterior
        </label>
        <input 
          type="password" 
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="w-full mt-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" 
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Nueva Contraseña
        </label>
        <input 
          type="password" 
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full mt-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" 
        />
      </div>

      <button 
        onClick={handleChangePassword}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
      >
        Cambiar Contraseña
      </button>
    </div>
    {isAdmin && (
  <div className="mt-8">
    <h3 className="text-lg font-bold text-gray-800 mb-4">
      Consultas de Ayuda
    </h3>

    {helpMessages.length === 0 ? (
      <p className="text-sm text-gray-500">No hay mensajes.</p>
    ) : (
      <div className="space-y-3">
        {helpMessages.map(msg => (
          <div
            key={msg.id}
            className={`p-4 rounded-lg border flex justify-between gap-4 ${
              msg.read ? "bg-gray-50" : "bg-blue-50 border-blue-200"
            }`}
          >
            <div className="flex-1">
              <p className="text-sm text-gray-800">{msg.message}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(msg.timestamp).toLocaleString()}
              </p>
            </div>

            <div className="flex gap-2 items-start">
              {!msg.read && (
                <button
                  onClick={async () => {
                    await markHelpAsRead(msg.id);
                    setHelpMessages(prev =>
                      prev.map(m =>
                        m.id === msg.id ? { ...m, read: true } : m
                      )
                    );
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Marcar leído
                </button>
              )}

              <button
                onClick={async () => {
                  await deleteHelpMessage(msg.id);
                  setHelpMessages(prev =>
                    prev.filter(m => m.id !== msg.id)
                  );
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Borrar
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
  )}

  </div>
)}

        </div>
</div>


      </div>
    
  );

  if (loading) {
  return (
    <div className="h-screen flex items-center justify-center">
      Cargando...
    </div>
  );
}

if (!firebaseUser) {
  return <Login />;
}

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans" style={{ fontSize: '14px' }}>
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-52 bg-white border-r border-gray-200 h-screen sticky top-0">
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
           <img 
              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" 
              alt="Logo" 
              className="w-8 h-8 object-contain"
           />
           <div>
              <h2 className="text-xl font-bold text-blue-600 tracking-tight leading-none">WikiMovil 3</h2>
              <p className="text-xs text-gray-400 mt-0.5">Base de Conocimientos</p>
           </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
          <SidebarItem 
            icon={Home} 
            label="Home" 
            active={state.activeTab === Tab.HOME} 
            onClick={() => setState({...state, activeTab: Tab.HOME})} 
          />
          <SidebarItem 
            icon={Search} 
            label="Explorar" 
            active={state.activeTab === Tab.EXPLORE} 
            onClick={() => setState({...state, activeTab: Tab.EXPLORE})} 
          />
          <SidebarItem 
            icon={UserIcon} 
            label="Perfil" 
            active={state.activeTab === Tab.PROFILE} 
            onClick={() => setState({...state, activeTab: Tab.PROFILE})} 
          />
          <div className="my-4 border-t border-gray-100"></div>
          <SidebarItem 
            icon={PlusSquare} 
            label="Nuevo Post" 
            active={state.activeTab === Tab.NEW_POST} 
            onClick={() => setState({...state, activeTab: Tab.NEW_POST})} 
          />
          <SidebarItem 
            icon={FolderOpen} 
            label="Biblioteca Drop" 
            active={state.activeTab === Tab.DROP_LIBRARY} 
            onClick={() => setState({...state, activeTab: Tab.DROP_LIBRARY})} 
          />
          <SidebarItem 
            icon={Bot} 
            label="Chat IA" 
            active={state.activeTab === Tab.AI_CHAT} 
            onClick={() => setState({...state, activeTab: Tab.AI_CHAT})} 
          />
          <div className="my-4 border-t border-gray-100"></div>
          <SidebarItem 
            icon={HelpCircle} 
            label="Ayuda" 
            active={state.activeTab === Tab.HELP} 
            onClick={() => setState({...state, activeTab: Tab.HELP})} 
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
  <div 
    onClick={handleLogout}
    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
  >
    <UserAvatar user={state.currentUser} size="sm" />
    
      <div className="overflow-hidden">
        <p className="text-sm font-medium text-gray-900 truncate">
          {state.currentUser.name}
        </p>
        <p className="text-xs text-gray-500 truncate">
          Cerrar Sesión
        </p>
      </div>

      <LogOut size={16} className="text-gray-400 ml-auto" />
    </div>
    </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between bg-white px-4 py-3 sticky top-0 z-20 shadow-sm">
           <div className="flex items-center gap-3">
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-700">
               {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
             </button>
             <img 
                src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" 
                alt="Logo" 
                className="w-8 h-8 object-contain"
             />
             <span className="font-bold text-xl text-blue-600">WikiMovil 3</span>
           </div>
           
           <div className="flex items-center gap-3">
              {/* Mobile Bell */}
              <div className="relative">
                 <button 
                   onClick={() => setShowNotifications(!showNotifications)}
                   className="text-gray-600 p-1"
                 >
                    <Bell size={24} />
                    {unreadNotifications > 0 && (
                       <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                           {unreadNotifications}
                       </span>
                    )}
                 </button>
                 {showNotifications && <NotificationDropdown />}
              </div>
              <UserAvatar user={state.currentUser} size="sm" />
           </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-200 absolute w-full z-10 shadow-xl">
             <nav className="p-2">
                <SidebarItem icon={Home} label="Home" active={state.activeTab === Tab.HOME} onClick={() => {setState({...state, activeTab: Tab.HOME}); setIsMobileMenuOpen(false);}} />
                <SidebarItem icon={Search} label="Explorar" active={state.activeTab === Tab.EXPLORE} onClick={() => {setState({...state, activeTab: Tab.EXPLORE}); setIsMobileMenuOpen(false);}} />
                <SidebarItem icon={UserIcon} label="Perfil" active={state.activeTab === Tab.PROFILE} onClick={() => {setState({...state, activeTab: Tab.PROFILE}); setIsMobileMenuOpen(false);}} />
                <SidebarItem icon={PlusSquare} label="Nuevo Post" active={state.activeTab === Tab.NEW_POST} onClick={() => {setState({...state, activeTab: Tab.NEW_POST}); setIsMobileMenuOpen(false);}} />
                <SidebarItem icon={FolderOpen} label="Biblioteca Drop" active={state.activeTab === Tab.DROP_LIBRARY} onClick={() => {setState({...state, activeTab: Tab.DROP_LIBRARY}); setIsMobileMenuOpen(false);}} />
                <SidebarItem icon={Bot} label="Chat IA" active={state.activeTab === Tab.AI_CHAT} onClick={() => {setState({...state, activeTab: Tab.AI_CHAT}); setIsMobileMenuOpen(false);}} />
                <SidebarItem icon={HelpCircle} label="Ayuda" active={state.activeTab === Tab.HELP} onClick={() => {setState({...state, activeTab: Tab.HELP}); setIsMobileMenuOpen(false);}} />
             </nav>
          </div>
        )}
        {/* Barra Personal */}
        <div className="hidden md:block sticky top-0 z-20">
          <div style={{
            background: 'linear-gradient(135deg, #00c8e8 0%, #0099cc 60%, #0077aa 100%)',
            position: 'relative',
            overflow: 'hidden',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '32px'
          }}>
            {/* Círculos decorativos */}
            <div style={{
              position: 'absolute', left: '-20px', top: '-30px',
              width: '120px', height: '120px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)'
            }} />
            <div style={{
              position: 'absolute', left: '60px', top: '-50px',
              width: '160px', height: '160px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)'
            }} />
            <div style={{
              position: 'absolute', right: '-10px', top: '-40px',
              width: '130px', height: '130px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.10)'
            }} />
            <span style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '22px',
              fontWeight: '300',
              letterSpacing: '2px',
              fontFamily: 'Inter, sans-serif',
              position: 'relative',
              zIndex: 1
            }}>personal</span>
          </div>

          {/* Campanita debajo de la barra */}
          <div className="flex justify-end px-8 py-2 bg-gray-50/90 backdrop-blur">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-full hover:bg-gray-100"
              >
                <Bell size={20} />
                {state.notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full px-1.5">
                    {state.notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              {showNotifications && <NotificationDropdown />}
            </div>
          </div>
        </div>

        {/* Dynamic Content — 15% más chico */}
        <div className="px-4 py-4 md:px-8 max-w-4xl mx-auto" style={{ fontSize: '13.6px' }}>
          {state.activeTab === Tab.HOME && renderHome()}
          {state.activeTab === Tab.EXPLORE && renderExplore()}
          {state.activeTab === Tab.NEW_POST && renderNewPost()}
          {state.activeTab === Tab.DROP_LIBRARY && renderDropLibrary()}
          {state.activeTab === Tab.AI_CHAT && renderAIChat()}
          {state.activeTab === Tab.HELP && renderHelp()}
          {state.activeTab === Tab.PROFILE && renderProfile()}
        </div>
      </main>

      {/* Mobile Bottom Navigation (Optional - Sticky Nav alternative to sidebar) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 z-30 pb-safe">
        <button onClick={() => setState({...state, activeTab: Tab.HOME})} className={`${state.activeTab === Tab.HOME ? 'text-blue-600' : 'text-gray-400'}`}>
          <Home size={24} />
        </button>
        <button onClick={() => setState({...state, activeTab: Tab.EXPLORE})} className={`${state.activeTab === Tab.EXPLORE ? 'text-blue-600' : 'text-gray-400'}`}>
          <Search size={24} />
        </button>
        <button onClick={() => setState({...state, activeTab: Tab.NEW_POST})} className={`${state.activeTab === Tab.NEW_POST ? 'text-blue-600' : 'text-gray-400'}`}>
          <PlusSquare size={24} />
        </button>
        <button onClick={() => setState({...state, activeTab: Tab.DROP_LIBRARY})} className={`${state.activeTab === Tab.DROP_LIBRARY ? 'text-blue-600' : 'text-gray-400'}`}>
          <FolderOpen size={24} />
        </button>
        <button onClick={() => setState({...state, activeTab: Tab.AI_CHAT})} className={`${state.activeTab === Tab.AI_CHAT ? 'text-blue-600' : 'text-gray-400'}`}>
          <Bot size={24} />
        </button>
      </div>

      
      {/* Delete Confirmation Modal */}
      {postToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
             <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">¿Eliminar publicación?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Esta acción no se puede deshacer. ¿Estás seguro de que quieres eliminar este post permanentemente?
                </p>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => setPostToDelete(null)}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                  >
                    Eliminar
                  </button>
                </div>
             </div>
          </div>
        </div>

      )}
    </div>
  );
}