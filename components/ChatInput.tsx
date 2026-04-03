import React, { useRef } from 'react';
import {
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  View,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';
import { useAppStore } from '@/store';

interface Props {
  onSend: (text: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  value: string;
  onChangeText: (text: string) => void;
  focusSignal?: number;
}

export const ChatInput: React.FC<Props> = ({
  onSend,
  isStreaming,
  onStop,
  value,
  onChangeText,
  focusSignal = 0,
}) => {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const { chatMode, setChatMode, setNicheBottomSheetOpen } = useAppStore((state) => ({
    chatMode: state.chatMode,
    setChatMode: state.setChatMode,
    setNicheBottomSheetOpen: state.setNicheBottomSheetOpen,
  }));

  React.useEffect(() => {
    if (focusSignal > 0) {
      inputRef.current?.focus();
    }
  }, [focusSignal]);

  const handleSend = () => {
    if (!value.trim() || isStreaming) return;
    onSend(value.trim());
    onChangeText('');
  };

  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
        },
      ]}
    >
      <View style={styles.topRow}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask anything privately..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={4000}
          style={[
            styles.input,
            {
              color: colors.text,
              fontFamily: FONTS.sans,
            },
          ]}
          onSubmitEditing={Platform.OS === 'ios' ? handleSend : undefined}
          blurOnSubmit={false}
          returnKeyType="default"
          textAlignVertical="top"
        />

        {isStreaming ? (
          <TouchableOpacity
            onPress={onStop}
            style={[styles.sendBtn, styles.stopBtn, { backgroundColor: colors.accent }]}
          >
            <View style={[styles.stopIcon, { backgroundColor: colors.background }]} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              {
                backgroundColor: canSend ? colors.accent : colors.surfaceAlt,
              },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={16}
              color={canSend ? colors.background : colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionRow}>
        <View style={styles.actionGroup}>
          <TouchableOpacity
            onPress={() => inputRef.current?.focus()}
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
          >
            <Ionicons name="add" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setNicheBottomSheetOpen(true)}
            style={[
              styles.iconBtn,
              {
                backgroundColor: colors.surface,
                borderColor: 'transparent',
              },
            ]}
          >
            <Ionicons
              name="options-outline"
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>


        </View>

        <View style={[styles.modeSwitch, { backgroundColor: colors.surfaceAlt, borderColor: colors.inputBorder }]}>
          {([
            { id: 'fast', label: '⚡ Fast' },
            { id: 'thinking', label: '🧠 Thinking' },
          ] as const).map((option) => {
            const selected = chatMode === option.id;

            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => setChatMode(option.id)}
                style={[
                  styles.modeBtn,
                  {
                    backgroundColor: selected ? colors.accent : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeText,
                    {
                      color: selected ? colors.background : colors.textSecondary,
                      fontFamily: selected ? FONTS.sansSemiBold : FONTS.sansMedium,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 140,
    minHeight: 52,
    paddingTop: 2,
    paddingBottom: 0,
    paddingHorizontal: 4,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  stopBtn: {
    paddingTop: 0,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    paddingHorizontal: 10,
    height: 30,
  },
  stopIcon: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  modeText: {
    fontSize: 13,
  },
});
