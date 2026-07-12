import { getCurrentUser } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';

function indexProfiles(profiles) {
  return Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
}

export async function loadMessageInbox() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { requiresLogin: true, conversations: [] };

  const { data: conversations, error: conversationsError } = await supabase
    .from('conversations')
    .select('id, initiator_id, recipient_id, last_message_at, created_at')
    .or(`initiator_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
    .order('last_message_at', { ascending: false });

  if (conversationsError) throw conversationsError;
  if (!conversations?.length) return { requiresLogin: false, conversations: [] };

  const conversationIds = conversations.map((conversation) => conversation.id);
  const otherUserIds = [...new Set(conversations.map((conversation) => (
    conversation.initiator_id === currentUser.id ? conversation.recipient_id : conversation.initiator_id
  )))];

  const [messagesResult, profilesResult] = await Promise.all([
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, receiver_id, content, created_at, read_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', otherUserIds),
  ]);

  if (messagesResult.error) throw messagesResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const latestMessageByConversation = {};
  const unreadCountByConversation = {};
  (messagesResult.data || []).forEach((message) => {
    if (!latestMessageByConversation[message.conversation_id]) {
      latestMessageByConversation[message.conversation_id] = message;
    }

    if (message.receiver_id === currentUser.id && !message.read_at) {
      unreadCountByConversation[message.conversation_id] = (unreadCountByConversation[message.conversation_id] || 0) + 1;
    }
  });

  const profilesById = indexProfiles(profilesResult.data);
  return {
    requiresLogin: false,
    conversations: conversations.map((conversation) => {
      const otherUserId = conversation.initiator_id === currentUser.id ? conversation.recipient_id : conversation.initiator_id;
      return {
        ...conversation,
        otherProfile: profilesById[otherUserId] || null,
        latestMessage: latestMessageByConversation[conversation.id] || null,
        unreadCount: unreadCountByConversation[conversation.id] || 0,
      };
    }),
  };
}

export async function loadConversation(conversationId, { markRead = true } = {}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { requiresLogin: true, conversation: null, messages: [] };

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id, initiator_id, recipient_id, last_message_at, created_at')
    .eq('id', conversationId)
    .maybeSingle();

  if (conversationError) throw conversationError;
  if (!conversation) throw new Error('找不到這段私訊，或你沒有查看權限。');

  const otherUserId = conversation.initiator_id === currentUser.id ? conversation.recipient_id : conversation.initiator_id;
  const [messagesResult, profileResult] = await Promise.all([
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, receiver_id, content, created_at, read_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, message_permission')
      .eq('id', otherUserId)
      .maybeSingle(),
  ]);

  if (messagesResult.error) throw messagesResult.error;
  if (profileResult.error) throw profileResult.error;

  if (markRead) {
    const { error: markReadError } = await supabase.rpc('mark_conversation_read', { target_conversation_id: conversation.id });
    if (markReadError) throw markReadError;
  }

  return {
    requiresLogin: false,
    currentUser,
    conversation,
    otherProfile: profileResult.data || null,
    messages: messagesResult.data || [],
  };
}

export async function loadMessageTarget(username) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { requiresLogin: true, profile: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, message_permission')
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;
  return { requiresLogin: false, currentUser, profile: data || null };
}

export async function sendDirectMessage(targetUserId, content) {
  const { data, error } = await supabase.rpc('send_direct_message', {
    target_user_id: targetUserId,
    message_content: content,
  });

  if (error) throw error;
  return data;
}
