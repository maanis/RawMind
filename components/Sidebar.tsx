import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';
import { NICHES } from '@/constants/niches';
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
  } = useAppStore();

  const handleNewChat = () => {
    const newChat = createChat(nicheId, nicheId === 'religion' ? religion : undefined);
    setActiveChat(newChat.id);
    setSidebarOpen(false);
  };

  if (!sidebarOpen) {
    return null;
  }

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
        <View style={[styles.sidebarHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.appName, { color: colors.text, fontFamily: FONTS.serifMedium }]}>RawMind</Text>
          <TouchableOpacity onPress={() => setSidebarOpen(false)}>
            <Ionicons name="close" size={22} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
          <TouchableOpacity onPress={handleNewChat} style={[styles.newChatBtn, { borderColor: colors.border }]}>
            <Ionicons name="add" size={18} color={colors.text} />
            <Text style={[styles.newChatText, { color: colors.text, fontFamily: FONTS.sansMedium }]}>New Chat</Text>
          </TouchableOpacity>

          {chats.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.historyHeader}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: FONTS.sansSemiBold }]}>RECENT</Text>
                <TouchableOpacity onPress={clearAllChats}>
                  <Text style={[styles.clearAll, { color: colors.danger, fontFamily: FONTS.sans }]}>Clear all</Text>
                </TouchableOpacity>
              </View>
              {chats.slice(0, 20).map((chat) => {
                const niche = NICHES.find((n) => n.id === chat.nicheId);
                return (
                  <TouchableOpacity
                    key={chat.id}
                    onPress={() => {
                      setActiveChat(chat.id);
                      setSidebarOpen(false);
                    }}
                    style={[
                      styles.chatHistoryItem,
                      activeChatId === chat.id && { backgroundColor: colors.surfaceAlt },
                    ]}
                  >
                    <Text style={styles.chatHistoryIcon}>{niche?.icon ?? '💬'}</Text>
                    <Text
                      style={[styles.chatHistoryTitle, { color: colors.textSecondary, fontFamily: FONTS.sans }]}
                      numberOfLines={1}
                    >
                      {chat.title}
                    </Text>
                    <TouchableOpacity onPress={() => deleteChat(chat.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: FONTS.sansSemiBold }]}>THEME</Text>
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
  newChatText: {
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 12.5,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  clearAll: { fontSize: 13.5 },
  chatHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  chatHistoryIcon: { fontSize: 14 },
  chatHistoryTitle: { flex: 1, fontSize: 15 },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  themeBtnText: { fontSize: 14 },
});
