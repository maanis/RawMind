import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';
import { NICHES } from '@/constants/niches';
import { getDefaultBackendUrl } from '@/services/ai';

const SIDEBAR_WIDTH = '78%';

export const Sidebar: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    sidebarOpen,
    setSidebarOpen,
    nicheId,
    religion,
    theme,
    setTheme,
    chats,
    activeChatId,
    setActiveChat,
    createChat,
    deleteChat,
    clearAllChats,
    backendUrlMode,
    customBackendUrl,
    setBackendUrlMode,
    setCustomBackendUrl,
  } = useAppStore();
  const [backendUrlDraft, setBackendUrlDraft] = useState(customBackendUrl);

  useEffect(() => {
    setBackendUrlDraft(customBackendUrl);
  }, [customBackendUrl, sidebarOpen]);

  const handleNewChat = () => {
    const newChat = createChat(nicheId, nicheId === 'religion' ? religion : undefined);
    setActiveChat(newChat.id);
    setSidebarOpen(false);
  };

  const effectiveBackendUrl =
    backendUrlMode === 'custom' && customBackendUrl ? customBackendUrl : getDefaultBackendUrl();

  const handleSaveBackendUrl = () => {
    const normalizedUrl = backendUrlDraft.trim().replace(/\/+$/, '');
    if (!normalizedUrl) return;
    setCustomBackendUrl(normalizedUrl);
    setBackendUrlMode('custom');
  };

  if (!sidebarOpen) return null;

  // Group chats by niche for organised history
  const chatsByNiche: Record<string, typeof chats> = {};
  chats.slice(0, 30).forEach((chat) => {
    if (!chatsByNiche[chat.nicheId]) chatsByNiche[chat.nicheId] = [];
    chatsByNiche[chat.nicheId].push(chat);
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <View style={styles.backdrop} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSidebarOpen(false)} />
      </View>

      <View
        style={[
          styles.sidebar,
          {
            width: SIDEBAR_WIDTH,
            backgroundColor: colors.sidebarBackground,
            paddingTop: insets.top + 12,
            borderRightColor: colors.border,
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.sidebarHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.appName, { color: colors.text, fontFamily: FONTS.serifMedium }]}>
            RawMind
          </Text>
          <TouchableOpacity onPress={() => setSidebarOpen(false)}>
            <Ionicons name="close" size={22} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
          {/* New Chat button */}
          <TouchableOpacity
            onPress={handleNewChat}
            style={[styles.newChatBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="add" size={18} color={colors.text} />
            <Text style={[styles.newChatText, { color: colors.text, fontFamily: FONTS.sansMedium }]}>
              New Chat
            </Text>
          </TouchableOpacity>

          {/* Chat history grouped by niche */}
          {Object.keys(chatsByNiche).length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.historyHeader}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: FONTS.sansSemiBold }]}>
                  RECENT
                </Text>
                <TouchableOpacity onPress={clearAllChats}>
                  <Text style={[styles.clearAll, { color: colors.danger, fontFamily: FONTS.sans }]}>
                    Clear all
                  </Text>
                </TouchableOpacity>
              </View>

              {Object.entries(chatsByNiche).map(([nId, nChats]) => {
                const niche = NICHES.find((n) => n.id === nId);
                return (
                  <View key={nId} style={styles.nicheGroup}>
                    {/* Niche label */}
                    <View style={styles.nicheGroupHeader}>
                      <Text style={styles.nicheGroupIcon}>{niche?.icon ?? '💬'}</Text>
                      <Text
                        style={[
                          styles.nicheGroupLabel,
                          { color: niche?.color ?? colors.textMuted, fontFamily: FONTS.sansSemiBold },
                        ]}
                      >
                        {niche?.persona ?? nId}
                      </Text>
                    </View>

                    {/* Chats within this niche */}
                    {nChats.map((chat) => (
                      <TouchableOpacity
                        key={chat.id}
                        onPress={() => {
                          setActiveChat(chat.id);
                          setSidebarOpen(false);
                        }}
                        style={[
                          styles.chatHistoryItem,
                          activeChatId === chat.id && {
                            backgroundColor: colors.surfaceAlt,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chatHistoryTitle,
                            { color: colors.textSecondary, fontFamily: FONTS.sans },
                          ]}
                          numberOfLines={1}
                        >
                          {chat.title}
                        </Text>
                        <TouchableOpacity
                          onPress={() => deleteChat(chat.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </>
          )}

          {/* Theme */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: FONTS.sansSemiBold }]}>
            THEME
          </Text>
          <View style={styles.themeRow}>
            {(['light', 'dark', 'system'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTheme(t)}
                style={[
                  styles.themeBtn,
                  {
                    backgroundColor: theme === t ? colors.text : colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.themeBtnText,
                    {
                      color: theme === t ? colors.background : colors.textSecondary,
                      fontFamily: FONTS.sansMedium,
                    },
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: FONTS.sansSemiBold }]}>
            BACKEND
          </Text>
          <Text style={[styles.backendValue, { color: colors.textSecondary, fontFamily: FONTS.sans }]}>
            {effectiveBackendUrl}
          </Text>
          <Text style={[styles.backendHint, { color: colors.textMuted, fontFamily: FONTS.sans }]}>
            Uses your Expo host IP by default. Paste a LAN/ngrok URL for Docker or remote access.
          </Text>
          <TextInput
            value={backendUrlDraft}
            onChangeText={setBackendUrlDraft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://example.ngrok.app"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.backendInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                fontFamily: FONTS.sans,
              },
            ]}
          />
          <View style={styles.backendActions}>
            <TouchableOpacity
              onPress={() => setBackendUrlMode('default')}
              style={[
                styles.backendActionBtn,
                {
                  backgroundColor: backendUrlMode === 'default' ? colors.text : colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.backendActionText,
                  {
                    color: backendUrlMode === 'default' ? colors.background : colors.textSecondary,
                    fontFamily: FONTS.sansMedium,
                  },
                ]}
              >
                Use Default
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveBackendUrl}
              style={[
                styles.backendActionBtn,
                {
                  backgroundColor: colors.accent,
                  borderColor: colors.accent,
                },
              ]}
            >
              <Text
                style={[
                  styles.backendActionText,
                  {
                    color: colors.background,
                    fontFamily: FONTS.sansMedium,
                  },
                ]}
              >
                Save Custom URL
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appName: {
    fontSize: 22,
    letterSpacing: -0.3,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 16,
  },
  newChatText: { fontSize: 16 },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clearAll: { fontSize: 13 },
  nicheGroup: {
    marginBottom: 12,
  },
  nicheGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    paddingLeft: 4,
  },
  nicheGroupIcon: { fontSize: 13 },
  nicheGroupLabel: { fontSize: 11, letterSpacing: 0.3 },
  chatHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 1,
  },
  chatHistoryTitle: { flex: 1, fontSize: 14 },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  backendValue: {
    fontSize: 13,
    marginBottom: 6,
  },
  backendHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  backendInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  backendActions: {
    gap: 8,
    marginBottom: 20,
  },
  backendActionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  backendActionText: {
    fontSize: 13,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  themeBtnText: { fontSize: 13 },
});
