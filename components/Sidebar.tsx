import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
  PanResponder,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';
import { NICHES, RELIGIONS } from '@/constants/niches';
import { NicheId } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

export const Sidebar: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    sidebarOpen,
    setSidebarOpen,
    nicheId,
    setNiche,
    religion,
    setReligion,
    theme,
    setTheme,
    chats,
    activeChatId,
    setActiveChat,
    createChat,
    deleteChat,
    clearAllChats,
  } = useAppStore();

  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sidebarOpenRef = useRef(sidebarOpen);

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  const animateTo = (toX: number, duration: number) => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: toX,
        duration,
        useNativeDriver: true,
        easing: toX === 0 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      }),
      Animated.timing(backdropOpacity, {
        toValue: toX === 0 ? 1 : 0,
        duration,
        useNativeDriver: false,
      }),
    ]).start();
  };

  useEffect(() => {
    animateTo(sidebarOpen ? 0 : -SIDEBAR_WIDTH, 200);
  }, [sidebarOpen]);

  const handleGestureEnd = (currentX: number, vx: number) => {
    const shouldOpen = currentX > -SIDEBAR_WIDTH / 2 || vx > 0.6;
    if (shouldOpen) {
      animateTo(0, 220);
      setSidebarOpen(true);
    } else {
      animateTo(-SIDEBAR_WIDTH, 220);
      setSidebarOpen(false);
    }
  };

  const closePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          sidebarOpenRef.current && Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 8,
        onPanResponderMove: (_, g) => {
          const nextX = Math.max(-SIDEBAR_WIDTH, Math.min(0, g.dx));
          translateX.setValue(nextX);
          const progress = (SIDEBAR_WIDTH + nextX) / SIDEBAR_WIDTH;
          backdropOpacity.setValue(Math.max(0, Math.min(1, progress)));
        },
        onPanResponderRelease: (_, g) => {
          const currentX = Math.max(-SIDEBAR_WIDTH, Math.min(0, g.dx));
          handleGestureEnd(currentX, g.vx);
        },
        onPanResponderTerminate: (_, g) => {
          const currentX = Math.max(-SIDEBAR_WIDTH, Math.min(0, g.dx));
          handleGestureEnd(currentX, g.vx);
        },
      }),
    []
  );

  const openPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !sidebarOpenRef.current && Math.abs(g.dx) > Math.abs(g.dy) && g.dx > 8,
        onPanResponderMove: (_, g) => {
          const nextX = Math.max(-SIDEBAR_WIDTH, Math.min(0, -SIDEBAR_WIDTH + g.dx));
          translateX.setValue(nextX);
          const progress = (SIDEBAR_WIDTH + nextX) / SIDEBAR_WIDTH;
          backdropOpacity.setValue(Math.max(0, Math.min(1, progress)));
        },
        onPanResponderRelease: (_, g) => {
          const currentX = Math.max(-SIDEBAR_WIDTH, Math.min(0, -SIDEBAR_WIDTH + g.dx));
          handleGestureEnd(currentX, g.vx);
        },
        onPanResponderTerminate: (_, g) => {
          const currentX = Math.max(-SIDEBAR_WIDTH, Math.min(0, -SIDEBAR_WIDTH + g.dx));
          handleGestureEnd(currentX, g.vx);
        },
      }),
    []
  );

  const handleNicheSelect = (id: NicheId) => {
    setNiche(id);
    const newChat = createChat(id, id === 'religion' ? religion : undefined);
    setActiveChat(newChat.id);
    setSidebarOpen(false);
  };

  const handleNewChat = () => {
    const newChat = createChat(nicheId, nicheId === 'religion' ? religion : undefined);
    setActiveChat(newChat.id);
    setSidebarOpen(false);
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {!sidebarOpen && (
        <View
          style={styles.edgeSwipeArea}
          pointerEvents="box-only"
          {...openPanResponder.panHandlers}
        />
      )}

      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents={sidebarOpen ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSidebarOpen(false)} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sidebar,
          {
            width: SIDEBAR_WIDTH,
            backgroundColor: colors.sidebarBackground,
            paddingTop: insets.top + 12,
            borderRightColor: colors.border,
            transform: [{ translateX }],
          },
        ]}
        {...closePanResponder.panHandlers}
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

          <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: FONTS.sansSemiBold }]}>MODES</Text>
          {NICHES.map((niche) => (
            <View key={niche.id}>
              <TouchableOpacity
                onPress={() => handleNicheSelect(niche.id)}
                style={[
                  styles.nicheItem,
                  nicheId === niche.id && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Text style={styles.nicheIcon}>{niche.icon}</Text>
                <View style={styles.nicheTextGroup}>
                  <Text
                    style={[
                      styles.nicheName,
                      {
                        color: nicheId === niche.id ? niche.color : colors.text,
                        fontFamily: FONTS.sansMedium,
                      },
                    ]}
                  >
                    {niche.label}
                  </Text>
                  <Text style={[styles.nicheDesc, { color: colors.textMuted, fontFamily: FONTS.sans }]}>
                    {niche.persona}
                  </Text>
                </View>
                {nicheId === niche.id && <Ionicons name="checkmark" size={16} color={niche.color} />}
              </TouchableOpacity>

              {niche.id === 'religion' && nicheId === 'religion' && (
                <View style={styles.subOptions}>
                  {RELIGIONS.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => setReligion(r.id)}
                      style={[
                        styles.religionItem,
                        religion === r.id && { backgroundColor: colors.surfaceAlt },
                        { borderColor: colors.border },
                      ]}
                    >
                      <Text style={styles.religionFlag}>{r.flag}</Text>
                      <Text
                        style={[
                          styles.religionLabel,
                          {
                            color: religion === r.id ? colors.accent : colors.textSecondary,
                            fontFamily: FONTS.sans,
                          },
                        ]}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

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
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  edgeSwipeArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 26,
    zIndex: 5,
  },
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
  nicheItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  nicheIcon: { fontSize: 18 },
  nicheTextGroup: { flex: 1 },
  nicheName: { fontSize: 16 },
  nicheDesc: { fontSize: 13.5, marginTop: 1 },
  subOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 12,
    paddingBottom: 8,
    paddingTop: 4,
  },
  religionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  religionFlag: { fontSize: 14 },
  religionLabel: { fontSize: 14 },
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
