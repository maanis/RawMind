import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { ChatScreen } from '@/components/ChatScreen';
import { Sidebar } from '@/components/Sidebar';

export default function Index() {
  const { colors } = useTheme();
  const { activeChatId, nicheId, religion, createChat } = useAppStore();

  // Ensure there's always an active chat on first launch
  useEffect(() => {
    if (!activeChatId) {
      createChat(nicheId, nicheId === 'religion' ? religion : undefined);
    }
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ChatScreen />
      <Sidebar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
