import { loadConversation, loadMessageInbox } from '@/lib/messages/directMessages';

let inboxCache = null;
const conversationCache = new Map();

export function getCachedMessageInbox() {
  return inboxCache;
}

export function cacheMessageInbox(inbox) {
  inboxCache = inbox || null;
}

export function getCachedConversation(conversationId) {
  return conversationCache.get(conversationId) || null;
}

export function cacheConversation(conversationId, conversation) {
  if (!conversationId || !conversation) return;
  conversationCache.set(conversationId, conversation);
}

export async function prefetchMessageInbox({ force = false } = {}) {
  if (!force && inboxCache) return inboxCache;
  const inbox = await loadMessageInbox();
  cacheMessageInbox(inbox);
  return inbox;
}

export async function prefetchConversation(conversationId, { force = false } = {}) {
  const cached = getCachedConversation(conversationId);
  if (!force && cached) return cached;
  const conversation = await loadConversation(conversationId, { markRead: false });
  cacheConversation(conversationId, conversation);
  return conversation;
}
