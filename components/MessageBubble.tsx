import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

export const MessageBubble: React.FC<Props> = ({ message, isStreaming }) => {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const markdownStyles = StyleSheet.create({
    body: {
      color: isUser ? colors.userBubbleText : colors.aiBubbleText,
      fontFamily: FONTS.serif,
      fontSize: 17,
      lineHeight: 26,
    },
    heading1: {
      fontFamily: FONTS.serifMedium,
      fontSize: 22,
      color: isUser ? colors.userBubbleText : colors.text,
      marginBottom: 8,
      marginTop: 12,
    },
    heading2: {
      fontFamily: FONTS.serifMedium,
      fontSize: 19,
      color: isUser ? colors.userBubbleText : colors.text,
      marginBottom: 6,
      marginTop: 10,
    },
    heading3: {
      fontFamily: FONTS.sansSemiBold,
      fontSize: 17,
      color: isUser ? colors.userBubbleText : colors.text,
      marginBottom: 4,
      marginTop: 8,
    },
    strong: {
      fontFamily: FONTS.sansSemiBold,
      color: isUser ? colors.userBubbleText : colors.text,
    },
    em: {
      fontFamily: FONTS.serif,
      fontStyle: 'italic',
    },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    bullet_list_icon: {
      color: isUser ? colors.userBubbleText : colors.accent,
      marginRight: 8,
      fontSize: 17,
      lineHeight: 26,
    },
    code_inline: {
      fontFamily: FONTS.mono,
      fontSize: 14,
      backgroundColor: isUser
        ? 'rgba(255,255,255,0.15)'
        : colors.codeBackground,
      color: isUser ? colors.userBubbleText : colors.accent,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: colors.codeBackground,
      borderRadius: 8,
      padding: 12,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    code_block: {
      fontFamily: FONTS.mono,
      fontSize: 14,
      color: colors.codeText,
      lineHeight: 22,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      paddingLeft: 12,
      marginVertical: 8,
      opacity: 0.85,
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 12,
    },
    paragraph: {
      marginBottom: 8,
      marginTop: 0,
    },
    link: {
      color: colors.accent,
      textDecorationLine: 'underline',
    },
  });

  // Custom code block with copy button
  const renderRules = {
    fence: (node: any, children: any, parent: any, styles: any) => {
      const code = node.content ?? '';
      return (
        <CodeBlock key={node.key} code={code} colors={colors} />
      );
    },
  };

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.aiContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
          isUser ? styles.userBubbleWidth : styles.aiBubbleWidth,
          { backgroundColor: isUser ? colors.userBubble : 'transparent' },
        ]}
      >

        {message.content.trim() !== '' ? (
          <View>
            <Markdown style={markdownStyles} rules={renderRules}>
              {message.content + (isStreaming ? '▋' : '')}
            </Markdown>
          </View>
        ) : isStreaming ? (
          <TypingDots colors={colors} />
        ) : null}

        {!isUser && !isStreaming && message.content.trim() !== '' && (
          <TouchableOpacity
            onPress={handleCopy}
            style={styles.copyBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={14}
              color={copied ? colors.success : colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// Separate code block component with copy
const CodeBlock: React.FC<{ code: string; colors: any }> = ({
  code,
  colors,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View
      style={[
        codeStyles.container,
        { backgroundColor: colors.codeBackground, borderColor: colors.border },
      ]}
    >
      <View style={[codeStyles.header, { borderBottomColor: colors.border }]}>
        <Text style={[codeStyles.lang, { color: colors.textMuted }]}>code</Text>
        <TouchableOpacity onPress={handleCopy} style={codeStyles.copyBtn}>
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={13}
            color={copied ? colors.success : colors.textMuted}
          />
          <Text style={[codeStyles.copyText, { color: copied ? colors.success : colors.textMuted }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text
        style={[
          codeStyles.code,
          { color: colors.codeText, fontFamily: FONTS.mono },
        ]}
        selectable
      >
        {code.trim()}
      </Text>
    </View>
  );
};

const TypingDots: React.FC<{ colors: any }> = ({ colors }) => (
  <View style={styles.typingRow}>
    {[0, 1, 2].map((i) => (
      <View
        key={i}
        style={[styles.dot, { backgroundColor: colors.textMuted }]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  userContainer: {
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  aiContainer: {
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
    borderWidth: 1,
  },
  avatarText: {
    fontSize: 15,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 8,
  },
  userBubbleWidth: {
    maxWidth: '84%',
  },
  aiBubbleWidth: {
    width: '100%',
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
  },
  copyBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    padding: 2,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    opacity: 0.6,
  },
});

const codeStyles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  lang: {
    fontSize: 13,
    fontFamily: FONTS.mono,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyText: {
    fontSize: 13,
    fontFamily: FONTS.sans,
  },
  code: {
    fontSize: 14,
    lineHeight: 22,
    padding: 12,
  },
});
