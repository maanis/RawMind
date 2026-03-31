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
import { NicheBottomSheet } from '@/components/NicheBottomSheet';
import { FONTS } from '@/constants/theme';
import { NICHES } from '@/constants/niches';
import { ChatMessage } from '@/types';

export const ChatScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    activeChatId,
    nicheId,
    religion,
    createChat,
    setSidebarOpen,
    nicheBottomSheetOpen,
    setNicheBottomSheetOpen,
  } = useAppStore();

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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* KeyboardAvoidingView — proper behavior for both iOS and Android */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

          <Pressable
            onPress={() => setNicheBottomSheetOpen(true)}
            style={styles.headerCenter}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.headerPersona, { color: colors.text, fontFamily: FONTS.serifMedium }]}>
              {currentNiche?.icon} {currentNiche?.persona ?? 'RawMind'}
            </Text>
          </Pressable>

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

        {/* Messages — wrapped in Pressable to dismiss keyboard on tap */}
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

        {/* Input — positioned naturally at bottom, moves with keyboard */}
        <ChatInput
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={stopStreaming}
        />
      </KeyboardAvoidingView>

      {/* Bottom Sheet — overlays entire screen, animated separately */}
      <NicheBottomSheet
        visible={nicheBottomSheetOpen}
        onClose={() => setNicheBottomSheetOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardAvoidingView: {
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
    paddingHorizontal: 8,
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
