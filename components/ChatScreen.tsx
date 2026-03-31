import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store';
import { useChat } from '@/hooks/useChat';
import { useTheme } from '@/hooks/useTheme';
import { MessageBubble } from '@/components/MessageBubble';
import { ChatInput } from '@/components/ChatInput';
import { FONTS } from '@/constants/theme';
import { NICHES } from '@/constants/niches';
import { ChatMessage } from '@/types';

export const ChatScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeChatId, nicheId, religion, createChat, setSidebarOpen } =
    useAppStore();

  const chatId = activeChatId || '';

  const { messages, isStreaming, sendMessage, stopStreaming } = useChat(chatId);

  const flatListRef = useRef<FlatList>(null);

  const currentNiche = NICHES.find((n) => n.id === nicheId);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isStreaming]);

  const handleSend = useCallback(
    (text: string) => {
      if (!activeChatId) {
        const newChat = createChat(nicheId, nicheId === 'religion' ? religion : undefined);
        // re-render will pick up new chatId
      }
      sendMessage(text);
    },
    [activeChatId, nicheId, religion, sendMessage, createChat]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      if (!item) return null;

      return (
        <MessageBubble
          message={item}
          isStreaming={
            isStreaming &&
            index === messages.length - 1 &&
            item.role === 'assistant'
          }
        />
      );
    },
    [isStreaming, messages.length]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{currentNiche?.icon ?? '⚡'}</Text>
      <Text style={[styles.emptyPersona, { color: colors.textMuted, fontFamily: FONTS.serifMedium }]}>
        {currentNiche?.persona ?? 'Unleashed'}
      </Text>
      <Text style={[styles.emptyDesc, { color: colors.textMuted, fontFamily: FONTS.serifMedium }]}>
        {currentNiche?.description ?? 'Ask anything'}
      </Text>
    </View>
  );

  return (
    // KeyboardAvoidingView — the CORRECT fix for keyboard layout
    // behavior='padding' on iOS, nothing needed on Android with windowSoftInputMode=adjustResize
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.headerBackground,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setSidebarOpen(true)}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="menu" size={22} color={colors.icon} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerPersona, { color: colors.text, fontFamily: FONTS.serifMedium }]}>
            {currentNiche?.icon} {currentNiche?.persona ?? 'RawMind'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            const newChat = createChat(nicheId, nicheId === 'religion' ? religion : undefined);
          }}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={22} color={colors.icon} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.messageListEmpty,
            { flexGrow: 1 },
          ]}
          ListEmptyComponent={EmptyState}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        />
      </Pressable>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
        onStop={stopStreaming}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerPersona: {
    fontSize: 19,
    letterSpacing: -0.2,
  },
  messageList: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  messageListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 8,
  },
  emptyPersona: {
    fontSize: 24,
    letterSpacing: -0.3,
  },
  emptyDesc: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
