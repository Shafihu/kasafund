import { AnimatedLoader } from "@/components/ui/AnimatedLoader";
import { apiService, type ApiGroupMessage } from "@/services/apiService";
import { cacheMessages, getCachedMessages, mergeMessages } from "@/services/chatCache";
import { createChatSocket } from "@/services/chatSocket";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Socket } from "socket.io-client";

const C = {
  primary: "#0B4D3E", dark: "#07372C", soft: "#E5F2ED", gold: "#E8B84B",
  bg: "#F5F7F6", white: "#FFFFFF", border: "#DFE7E3", text: "#12211C",
  muted: "#697873", error: "#C0392B",
};

function initials(name?: string) {
  return (name || "Member").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit" });
}

function TypingIndicator({ names }: { names: string[] }) {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.stagger(120, dots.map((dot) => Animated.sequence([
      Animated.timing(dot, { duration: 220, toValue: -4, useNativeDriver: true }),
      Animated.timing(dot, { duration: 220, toValue: 0, useNativeDriver: true }),
    ]))));
    animation.start();
    return () => animation.stop();
  }, [dots]);
  const label = names.length === 1 ? `${names[0]} is typing` : `${names.length} people are typing`;
  return (
    <View style={styles.typingRow}>
      <View style={styles.typingBubble}>
        {dots.map((dot, index) => <Animated.View key={index} style={[styles.typingDot, { transform: [{ translateY: dot }] }]} />)}
      </View>
      <Text numberOfLines={1} style={styles.typingText}>{label}</Text>
    </View>
  );
}

export default function GroupChatScreen() {
  const router = useRouter();
  const { id, groupName, role } = useLocalSearchParams<{ id: string; groupName?: string; role?: string }>();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList<ApiGroupMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [messages, setMessages] = useState<ApiGroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id || !currentUserId) return;
    let active = true;
    let socket: Socket | null = null;
    const typingTimers = remoteTypingTimers.current;

    const start = async () => {
      const cached = await getCachedMessages(id, currentUserId);
      if (active && cached.length) {
        setMessages(cached);
        setLoading(false);
      }

      try {
        const response = await apiService.getGroupMessages(id);
        const synchronized = mergeMessages(cached, response.data);
        if (active) setMessages(synchronized);
        void cacheMessages(id, currentUserId, synchronized);
        await apiService.markGroupChatRead(id);
      } catch (error) {
        if (active && !cached.length) {
          Alert.alert("Could not load chat", error instanceof Error ? error.message : "Please try again.");
        }
      } finally {
        if (active) setLoading(false);
      }

      try {
        socket = await createChatSocket();
        if (!active) return socket.disconnect();
        socketRef.current = socket;
        socket.on("connect", () => {
          setConnected(true);
          socket?.emit("chat:join", { groupId: id }, (result: { success: boolean; message?: string }) => {
            if (!result.success) Alert.alert("Chat unavailable", result.message || "Could not join this chat.");
          });
        });
        socket.on("disconnect", () => setConnected(false));
        socket.on("connect_error", () => setConnected(false));
        socket.on("chat:message", (message: ApiGroupMessage) => {
          if (message.groupId !== id) return;
          setMessages((current) => {
            const next = current.some((item) => item._id === message._id) ? current : [...current, message];
            void cacheMessages(id, currentUserId, next);
            return next;
          });
          void apiService.markGroupChatRead(id).catch(() => undefined);
        });
        socket.on("chat:message_deleted", ({ messageId, deletedAt }: { messageId: string; deletedAt: string }) => {
          setMessages((current) => {
            const next = current.map((item) => item._id === messageId
              ? { ...item, text: "This message was deleted", deletedAt }
              : item);
            void cacheMessages(id, currentUserId, next);
            return next;
          });
        });
        socket.on("chat:typing", ({ groupId, userId, fullName, isTyping }: { groupId: string; userId: string; fullName: string; isTyping: boolean }) => {
          if (groupId !== id || userId === currentUserId) return;
          const existingTimer = typingTimers.get(userId);
          if (existingTimer) clearTimeout(existingTimer);
          if (!isTyping) {
            typingTimers.delete(userId);
            setTypingUsers((current) => {
              const next = { ...current }; delete next[userId]; return next;
            });
            return;
          }
          setTypingUsers((current) => ({ ...current, [userId]: fullName || "Someone" }));
          typingTimers.set(userId, setTimeout(() => {
            typingTimers.delete(userId);
            setTypingUsers((current) => {
              const next = { ...current }; delete next[userId]; return next;
            });
          }, 2500));
        });
      } catch {
        if (active) setConnected(false);
      }
    };
    void start();
    return () => {
      active = false;
      socket?.disconnect();
      socketRef.current = null;
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      typingTimers.forEach(clearTimeout);
      typingTimers.clear();
    };
  }, [currentUserId, id]);

  useEffect(() => {
    if (messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const send = () => {
    const text = draft.trim();
    const socket = socketRef.current;
    if (!text || !socket?.connected || !id || sending) return;
    socket.emit("chat:typing", { groupId: id, isTyping: false });
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    setSending(true);
    socket.emit("chat:send", { groupId: id, text }, (result: { success: boolean; message?: string }) => {
      setSending(false);
      if (result.success) setDraft("");
      else Alert.alert("Message not sent", result.message || "Please try again.");
    });
  };

  const updateDraft = (value: string) => {
    setDraft(value);
    const socket = socketRef.current;
    if (!socket?.connected || !id) return;
    socket.emit("chat:typing", { groupId: id, isTyping: Boolean(value.trim()) });
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    if (value.trim()) {
      typingStopTimer.current = setTimeout(() => {
        socketRef.current?.emit("chat:typing", { groupId: id, isTyping: false });
      }, 1200);
    }
  };

  const deleteMessage = (message: ApiGroupMessage) => {
    if (message.deletedAt || !id || (message.sender._id !== currentUserId && role !== "owner")) return;
    Alert.alert("Delete message?", "This will remove the message for everyone in the group.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try { await apiService.deleteGroupMessage(id, message._id); }
          catch (error) { Alert.alert("Could not delete message", error instanceof Error ? error.message : "Please try again."); }
        },
      },
    ]);
  };

  const replyToMessage = (message: ApiGroupMessage) => {
    const name = message.sender._id === currentUserId ? "" : message.sender.fullName?.split(" ")[0];
    setDraft((current) => name && !current ? `@${name} ` : current);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const shareMessage = (message: ApiGroupMessage) => {
    void Share.share({ message: `${message.sender.fullName || "Group member"}: ${message.text}` });
  };

  const showMessageActions = (message: ApiGroupMessage) => {
    if (message.deletedAt) return;
    const canDelete = message.sender._id === currentUserId || role === "owner";
    Alert.alert(message.sender.fullName || "Message", undefined, [
      { text: "Copy", onPress: () => void Clipboard.setStringAsync(message.text) },
      { text: "Reply", onPress: () => replyToMessage(message) },
      { text: "Share", onPress: () => shareMessage(message) },
      ...(canDelete ? [{ text: "Delete", style: "destructive" as const, onPress: () => deleteMessage(message) }] : []),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const renderMessage = ({ item, index }: { item: ApiGroupMessage; index: number }) => {
    const mine = item.sender._id === currentUserId;
    const canDelete = mine || role === "owner";
    const previous = messages[index - 1];
    const showSender = !mine && previous?.sender._id !== item.sender._id;
    if (item.type === "system") return <View style={styles.systemPill}><Text style={styles.systemText}>{item.text}</Text></View>;
    const bubble = (
      <View style={[styles.bubble, mine ? styles.mineBubble : styles.theirBubble, item.deletedAt && styles.deletedBubble]}>
        {showSender && <Text style={styles.senderName}>{item.sender.fullName || "Member"}</Text>}
        <Text style={[styles.messageText, mine && styles.mineText, item.deletedAt && styles.deletedText]}>{item.text}</Text>
        <Text style={[styles.messageTime, mine && styles.mineTime]}>{timeLabel(item.createdAt)}</Text>
      </View>
    );
    return (
      <View style={[styles.messageRow, mine && styles.messageRowMine]}>
        {!mine && showSender ? (
          <TouchableOpacity
            activeOpacity={0.75}
            accessibilityLabel={`View ${item.sender.fullName || "member"} profile`}
            onPress={() => router.push({ pathname: "/users/[id]", params: { id: item.sender._id } })}
          >
            {item.sender.avatarUrl
              ? <Image source={{ uri: item.sender.avatarUrl }} style={styles.avatar} />
              : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials(item.sender.fullName)}</Text></View>}
          </TouchableOpacity>
        ) : !mine ? <View style={styles.avatarSpacer} /> : null}
        {Platform.OS === "ios" && !item.deletedAt ? (
          <Link
            asChild
            href={{ pathname: "/groups/[id]/chat", params: { id, groupName, role } }}
            onPress={(event) => event.preventDefault()}
          >
            <Link.Trigger>
              <TouchableOpacity activeOpacity={1} style={styles.messageMenuTrigger}>
                {bubble}
              </TouchableOpacity>
            </Link.Trigger>
            <Link.Preview style={{ height: 180, width: 310 }}>
              <View style={styles.preview}>
                <View style={styles.previewHeader}>
                  <View style={styles.previewAvatar}><Text style={styles.previewAvatarText}>{initials(item.sender.fullName)}</Text></View>
                  <View style={styles.previewHeaderCopy}><Text style={styles.previewName}>{item.sender.fullName || "Member"}</Text><Text style={styles.previewTime}>{new Date(item.createdAt).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}</Text></View>
                </View>
                <Text numberOfLines={5} style={styles.previewMessage}>{item.text}</Text>
              </View>
            </Link.Preview>
            <Link.Menu>
              <Link.MenuAction icon="doc.on.doc" onPress={() => void Clipboard.setStringAsync(item.text)} title="Copy" />
              <Link.MenuAction icon="arrowshape.turn.up.left" onPress={() => replyToMessage(item)} title="Reply" />
              <Link.MenuAction icon="square.and.arrow.up" onPress={() => shareMessage(item)} title="Share" />
              <Link.MenuAction destructive disabled={!canDelete} icon="trash" onPress={() => deleteMessage(item)} title="Delete" />
            </Link.Menu>
          </Link>
        ) : (
          <TouchableOpacity activeOpacity={0.9} delayLongPress={350} onLongPress={() => showMessageActions(item)}>{bubble}</TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <StatusBar backgroundColor={C.primary} barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.safe}>
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}><Ionicons name="arrow-back" size={21} color={C.white} /></TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={styles.title}>{groupName || "Group chat"}</Text>
              <View style={styles.statusRow}><View style={[styles.statusDot, connected && styles.statusDotOnline]} /><Text style={styles.statusText}>{connected ? "Live" : "Connecting…"}</Text></View>
            </View>
            <View style={styles.groupIcon}><Ionicons name="people" size={20} color={C.white} /></View>
          </View>
        </SafeAreaView>

        <View style={styles.chatBody}>
          {loading ? <View style={styles.center}><AnimatedLoader accessibilityLabel="Loading group chat" /></View> : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item._id}
              renderItem={renderMessage}
              contentContainerStyle={[styles.list, !messages.length && styles.emptyList]}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={28} color={C.primary} /></View><Text style={styles.emptyTitle}>Start the conversation</Text><Text style={styles.emptyText}>Messages here are only visible to active members of this group.</Text></View>}
            />
          )}
          {!!Object.keys(typingUsers).length && <TypingIndicator names={Object.values(typingUsers)} />}
        </View>
        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            multiline
            maxLength={1000}
            onBlur={() => socketRef.current?.emit("chat:typing", { groupId: id, isTyping: false })}
            onChangeText={updateDraft}
            placeholder="Message the group…"
            placeholderTextColor="#93A09B"
            style={styles.input}
            value={draft}
          />
          <TouchableOpacity disabled={!draft.trim() || !connected || sending} onPress={send} style={[styles.send, (!draft.trim() || !connected || sending) && styles.sendDisabled]}>
            <Ionicons name="arrow-up" size={21} color={C.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: C.bg, flex: 1 },
  headerSafeArea: { backgroundColor: C.primary },
  header: { alignItems: "center", backgroundColor: C.primary, flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  headerButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  headerCopy: { flex: 1 }, title: { color: C.white, fontSize: 17, fontWeight: "800" },
  statusRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 3 },
  statusDot: { backgroundColor: "#B8C0BD", borderRadius: 4, height: 7, width: 7 }, statusDotOnline: { backgroundColor: "#22A06B" },
  statusText: { color: "rgba(255,255,255,0.72)", fontSize: 10, fontWeight: "600" },
  groupIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  chatBody: { backgroundColor: C.bg, flex: 1, overflow: "hidden" },
  list: { flexGrow: 1, paddingHorizontal: 14, paddingVertical: 18 }, emptyList: { justifyContent: "center" },
  empty: { alignItems: "center", paddingHorizontal: 38 }, emptyIcon: { alignItems: "center", backgroundColor: C.soft, borderRadius: 22, height: 68, justifyContent: "center", marginBottom: 14, width: 68 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: "800" }, emptyText: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  messageRow: { alignItems: "flex-end", flexDirection: "row", marginBottom: 5, maxWidth: "86%" }, messageRowMine: { alignSelf: "flex-end" },
  messageMenuTrigger: { alignSelf: "flex-start" },
  avatar: { borderRadius: 15, height: 30, marginRight: 7, width: 30 }, avatarFallback: { alignItems: "center", backgroundColor: C.soft, borderRadius: 15, height: 30, justifyContent: "center", marginRight: 7, width: 30 },
  avatarText: { color: C.primary, fontSize: 9, fontWeight: "800" }, avatarSpacer: { marginRight: 7, width: 30 },
  bubble: { borderRadius: 17, maxWidth: "100%", minWidth: 76, paddingHorizontal: 12, paddingVertical: 9 }, mineBubble: { backgroundColor: C.primary, borderBottomRightRadius: 5 }, theirBubble: { backgroundColor: C.white, borderBottomLeftRadius: 5, borderColor: C.border, borderWidth: 1 },
  senderName: { color: C.primary, fontSize: 10, fontWeight: "800", marginBottom: 3 }, messageText: { color: C.text, fontSize: 14, lineHeight: 19 }, mineText: { color: C.white },
  messageTime: { alignSelf: "flex-end", color: C.muted, fontSize: 8, marginTop: 4 }, mineTime: { color: "rgba(255,255,255,.62)" },
  deletedBubble: { opacity: 0.72 }, deletedText: { fontStyle: "italic" },
  preview: { backgroundColor: C.white, flex: 1, padding: 18 }, previewHeader: { alignItems: "center", flexDirection: "row", marginBottom: 15 },
  previewAvatar: { alignItems: "center", backgroundColor: C.soft, borderRadius: 20, height: 40, justifyContent: "center", marginRight: 11, width: 40 }, previewAvatarText: { color: C.primary, fontSize: 11, fontWeight: "800" },
  previewHeaderCopy: { flex: 1 }, previewName: { color: C.text, fontSize: 14, fontWeight: "800" }, previewTime: { color: C.muted, fontSize: 9, marginTop: 3 }, previewMessage: { color: C.text, fontSize: 14, lineHeight: 20 },
  systemPill: { alignSelf: "center", backgroundColor: C.soft, borderRadius: 12, marginVertical: 8, paddingHorizontal: 12, paddingVertical: 7 }, systemText: { color: C.muted, fontSize: 10, fontWeight: "600" },
  typingRow: { alignItems: "center", backgroundColor: C.bg, flexDirection: "row", gap: 8, minHeight: 34, paddingHorizontal: 15, paddingTop: 5 },
  typingBubble: { alignItems: "center", backgroundColor: C.white, borderColor: C.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 3, height: 27, paddingHorizontal: 9 },
  typingDot: { backgroundColor: C.primary, borderRadius: 3, height: 5, width: 5 }, typingText: { color: C.muted, flex: 1, fontSize: 10, fontStyle: "italic", fontWeight: "600" },
  composer: { alignItems: "flex-end", backgroundColor: C.white, borderTopColor: C.border, borderTopWidth: 1, flexDirection: "row", gap: 9, paddingBottom: 12, paddingHorizontal: 14, paddingTop: 10 },
  input: { backgroundColor: C.bg, borderColor: C.border, borderRadius: 18, borderWidth: 1, color: C.text, flex: 1, fontSize: 14, maxHeight: 110, minHeight: 46, paddingHorizontal: 15, paddingTop: 12 },
  send: { alignItems: "center", backgroundColor: C.primary, borderRadius: 23, height: 46, justifyContent: "center", width: 46 }, sendDisabled: { opacity: 0.38 },
});
