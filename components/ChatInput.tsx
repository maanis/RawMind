import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';

interface Props {
  onSend: (text: string) => void;
  isStreaming: boolean;
  onStop: () => void;
}

export const ChatInput: React.FC<Props> = ({ onSend, isStreaming, onStop }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    if (!text.trim() || isStreaming) return;
    onSend(text.trim());
    setText('');
    Keyboard.dismiss();
  };

  const canSend = text.trim().length > 0 && !isStreaming;

  return (
    // No KeyboardAvoidingView here — handled at screen level with KeyboardController
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          // Only add bottom inset for safe area, NOT extra keyboard padding
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.inputBorder,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
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
        />

        {isStreaming ? (
          <TouchableOpacity onPress={onStop} style={[styles.sendBtn, { backgroundColor: colors.text }]}>
            <View style={[styles.stopIcon, { backgroundColor: colors.background }]} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              {
                backgroundColor: canSend ? colors.text : colors.surfaceAlt,
              },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={canSend ? colors.background : colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    maxHeight: 130,
    paddingTop: Platform.OS === 'ios' ? 6 : 4,
    paddingBottom: Platform.OS === 'ios' ? 6 : 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  stopIcon: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
});
