import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useAppStore } from '@/store';
import { useChat } from '@/hooks/useChat';
import { useTheme } from '@/hooks/useTheme';
import { MessageBubble } from '@/components/MessageBubble';
import { ChatInput } from '@/components/ChatInput';
import { StatusBubble } from '@/components/StatusBubble';
import { NicheBottomSheet } from '@/components/NicheBottomSheet';
import { CustomPersonaSheet } from '@/components/CustomPersonaSheet';
import { FONTS } from '@/constants/theme';
import { NICHES } from '@/constants/niches';
import { ChatMessage } from '@/types';

const AUTO_SCROLL_THRESHOLD = 80;
const COMPOSER_EXTRA_BOTTOM_PADDING = 14;

export const ChatScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [draftText, setDraftText] = useState('');
  const [inputFocusSignal, setInputFocusSignal] = useState(0);
  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const {
    activeChatId,
    nicheId,
    religion,
    createChat,
    setSidebarOpen,
    nicheBottomSheetOpen,
    setNicheBottomSheetOpen,
    customPersonaSheetOpen,
    setCustomPersonaSheetOpen,
  } = useAppStore();

  const chatId = activeChatId || '';

  const {
    messages,
    isStreaming,
    statusMessage,
    sendMessage,
    replaceUserMessage,
    regenerateAtMessage,
    stopStreaming,
  } = useChat(chatId);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottomRef = useRef(true);
  const currentNiche = NICHES.find((n) => n.id === nicheId);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  // Scroll when messages update or status appears
  useEffect(() => {
    if (messages.length > 0 || statusMessage) {
      isNearBottomRef.current = true;
      scrollToBottom(true);
    }
  }, [messages.length, isStreaming, statusMessage, scrollToBottom]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // Niche switch → new isolated chat
  const prevNicheRef = React.useRef(nicheId);
  useEffect(() => {
    if (prevNicheRef.current !== nicheId) {
      prevNicheRef.current = nicheId;
      if (nicheId !== 'custom') {
        createChat(nicheId, nicheId === 'religion' ? religion : undefined);
      }
    }
  }, [nicheId]);

  // Android keyboard handling
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setAndroidKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      isNearBottomRef.current = distanceFromBottom <= AUTO_SCROLL_THRESHOLD;
    },
    []
  );

  const handleSend = useCallback(
    async (text: string) => {
      setActiveActionMessageId(null);
      if (editingMessageId) {
        const targetId = editingMessageId;
        setEditingMessageId(null);
        await replaceUserMessage(targetId, text);
        return;
      }
      if (!activeChatId) {
        const newChat = createChat(nicheId, nicheId === 'religion' ? religion : undefined);
        await sendMessage(text, newChat.id);
        return;
      }
      await sendMessage(text);
    },
    [activeChatId, createChat, editingMessageId, nicheId, religion, replaceUserMessage, sendMessage]
  );

  const handleEditMessage = useCallback((message: ChatMessage) => {
    setDraftText(message.content);
    setEditingMessageId(message.id);
    setActiveActionMessageId(null);
    setInputFocusSignal((value) => value + 1);
  }, []);

  const handlePlayMessage = useCallback((message: ChatMessage) => {
    const plainText = message.content
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#>*_\-\[\]\(\)]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!plainText) return;

    if (playingMessageId === message.id) {
      Speech.stop();
      setPlayingMessageId(null);
      return;
    }

    Speech.stop();
    setPlayingMessageId(message.id);
    Speech.speak(plainText, {
      onDone: () => setPlayingMessageId(null),
      onStopped: () => setPlayingMessageId(null),
      onError: () => setPlayingMessageId(null),
    });
  }, [playingMessageId]);

  const handleRegenerate = useCallback(async (message: ChatMessage) => {
    setActiveActionMessageId(null);
    await regenerateAtMessage(message.id);
  }, [regenerateAtMessage]);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      if (!item) return null;
      return (
        <MessageBubble
          message={item}
          actionsVisible={activeActionMessageId === item.id}
          isStreaming={
            isStreaming &&
            index === messages.length - 1 &&
            item.role === 'assistant'
          }
          isPlaying={playingMessageId === item.id}
          onLongPress={item.role === 'user' ? () => setActiveActionMessageId(item.id) : undefined}
          onDismissActions={() => setActiveActionMessageId((current) => current === item.id ? null : current)}
          onEdit={item.role === 'user' ? handleEditMessage : undefined}
          onPlay={item.role === 'assistant' ? handlePlayMessage : undefined}
          onRegenerate={handleRegenerate}
        />
      );
    },
    [
      activeActionMessageId,
      handleEditMessage,
      handlePlayMessage,
      handleRegenerate,
      isStreaming,
      messages.length,
      playingMessageId,
    ]
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

  const composerBottomSpacing =
    Platform.OS === 'ios'
      ? insets.bottom + 8 + COMPOSER_EXTRA_BOTTOM_PADDING
      : androidKeyboardHeight > 0
        ? 8 + COMPOSER_EXTRA_BOTTOM_PADDING
        : Math.max(insets.bottom, 8) + COMPOSER_EXTRA_BOTTOM_PADDING;

  const chatContent = (
    <>
      <FlatList
        ref={flatListRef}
        data={messages}
        extraData={{
          statusMessage,
          isStreaming,
          activeActionMessageId,
          playingMessageId,
        }}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.messageList,
          messages.length === 0 && styles.messageListEmpty,
        ]}
        ListEmptyComponent={EmptyState}
        ListFooterComponent={
          // Status bubble appears below last message, inside the scroll view
          statusMessage ? (
            <StatusBubble message={statusMessage} />
          ) : null
        }
        onContentSizeChange={() => {
          if ((messages.length > 0 || statusMessage) && isNearBottomRef.current) {
            scrollToBottom(!isStreaming);
          }
        }}
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          setActiveActionMessageId(null);
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={false}
      />

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: composerBottomSpacing,
          },
        ]}
      >
        <ChatInput
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={stopStreaming}
          value={draftText}
          onChangeText={setDraftText}
          focusSignal={inputFocusSignal}
        />
      </View>
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
            createChat(nicheId, nicheId === 'religion' ? religion : undefined);
          }}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={22} color={colors.icon} />
        </TouchableOpacity>
      </View>

      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView
          style={styles.content}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          {chatContent}
        </KeyboardAvoidingView>
      ) : (
        <View
          style={[
            styles.content,
            androidKeyboardHeight > 0 && { paddingBottom: androidKeyboardHeight },
          ]}
        >
          {chatContent}
        </View>
      )}

      <NicheBottomSheet
        visible={nicheBottomSheetOpen}
        onClose={() => setNicheBottomSheetOpen(false)}
      />
      <CustomPersonaSheet
        visible={customPersonaSheetOpen}
        onClose={() => setCustomPersonaSheetOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    gap: 2,
  },
  headerPersona: {
    fontSize: 19,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  messageList: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  inputWrap: {
    paddingTop: 8,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyIcon: { fontSize: 50, marginBottom: 8 },
  emptyPersona: { fontSize: 24, letterSpacing: -0.3 },
  emptyDesc: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
});
