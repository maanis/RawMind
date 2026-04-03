import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';
import { ThemeColors } from '@/constants/theme';

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
  actionsVisible?: boolean;
  isPlaying?: boolean;
  leadText?: string | null;
  statusText?: string | null;
  onLongPress?: () => void;
  onDismissActions?: () => void;
  onEdit?: (message: ChatMessage) => void;
  onRegenerate?: (message: ChatMessage) => void;
  onPlay?: (message: ChatMessage) => void;
}

type RichSegment =
  | { type: 'markdown'; content: string }
  | { type: 'table'; header: string[]; rows: string[][] };

const isTableSegment = (
  segment: RichSegment,
): segment is Extract<RichSegment, { type: 'table' }> => segment.type === 'table';

const TABLE_SEPARATOR_RE = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)\|?\s*$/;

const looksLikeTableRow = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.includes('|')) return false;
  if (trimmed.startsWith('```')) return false;
  return true;
};

const parseTableRow = (line: string): string[] => {
  let trimmed = line.trim();

  if (trimmed.startsWith('|')) {
    trimmed = trimmed.slice(1);
  }

  if (trimmed.endsWith('|')) {
    trimmed = trimmed.slice(0, -1);
  }

  return trimmed.split('|').map((cell) => cell.trim());
};

const padRow = (row: string[], width: number): string[] => (
  row.length >= width ? row : [...row, ...Array(width - row.length).fill('')]
);

const parseRichContent = (content: string): RichSegment[] => {
  const lines = content.split('\n');
  const segments: RichSegment[] = [];
  const markdownBuffer: string[] = [];
  let inFence = false;

  const flushMarkdown = () => {
    if (markdownBuffer.length === 0) return;

    const markdown = markdownBuffer.join('\n').trim();
    markdownBuffer.length = 0;

    if (markdown) {
      segments.push({ type: 'markdown', content: markdown } as RichSegment);
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const nextLine = lines[i + 1] ?? '';

    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      markdownBuffer.push(line);
      continue;
    }

    const isTableStart =
      !inFence &&
      looksLikeTableRow(line) &&
      TABLE_SEPARATOR_RE.test(nextLine);

    if (!isTableStart) {
      markdownBuffer.push(line);
      continue;
    }

    flushMarkdown();

    const header = parseTableRow(line);
    const rows: string[][] = [];
    i += 2;

    while (i < lines.length) {
      const rowLine = lines[i];
      if (!looksLikeTableRow(rowLine)) break;
      rows.push(parseTableRow(rowLine));
      i += 1;
    }

    i -= 1;

    const width = Math.max(
      header.length,
      ...rows.map((row) => row.length),
    );

    segments.push({
      type: 'table',
      header: padRow(header, width),
      rows: rows.map((row) => padRow(row, width)),
    });
  }

  flushMarkdown();

  return segments.length > 0
    ? segments
    : [{ type: 'markdown', content } as RichSegment];
};

export const MessageBubble: React.FC<Props> = ({
  message,
  isStreaming,
  actionsVisible = false,
  isPlaying = false,
  leadText = null,
  statusText = null,
  onLongPress,
  onDismissActions,
  onEdit,
  onRegenerate,
  onPlay,
}) => {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const segments = useMemo(() => {
    const parsed = parseRichContent(message.content);

    if (!isStreaming) {
      return parsed;
    }

    const withCursor = [...parsed];
    const lastSegment = withCursor[withCursor.length - 1];

    if (lastSegment?.type === 'markdown') {
      withCursor[withCursor.length - 1] = {
        ...lastSegment,
        content: `${lastSegment.content}▋`,
      };
      return withCursor;
    }

    return [...withCursor, { type: 'markdown', content: '▋' } as RichSegment];
  }, [isStreaming, message.content]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    if (isUser) {
      onDismissActions?.();
    }
  };

  const handleEdit = () => {
    onEdit?.(message);
    onDismissActions?.();
  };

  const handleRegenerate = () => {
    onRegenerate?.(message);
    if (isUser) {
      onDismissActions?.();
    }
  };

  const handlePlay = () => {
    onPlay?.(message);
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
      color: isUser ? colors.userBubbleText : colors.aiBubbleText,
      marginBottom: 8,
      marginTop: 12,
    },
    heading2: {
      fontFamily: FONTS.serifMedium,
      fontSize: 19,
      color: isUser ? colors.userBubbleText : colors.aiBubbleText,
      marginBottom: 6,
      marginTop: 10,
    },
    heading3: {
      fontFamily: FONTS.sansSemiBold,
      fontSize: 17,
      color: isUser ? colors.userBubbleText : colors.aiBubbleText,
      marginBottom: 4,
      marginTop: 8,
    },
    strong: {
      fontFamily: FONTS.sansSemiBold,
      color: isUser ? colors.userBubbleText : colors.aiBubbleText,
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
      paddingVertical: 8,
      paddingRight: 10,
      marginVertical: 8,
      backgroundColor: isUser ? 'rgba(255,255,255,0.08)' : colors.accentLight,
      borderRadius: 10,
      opacity: 0.95,
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

  const renderRules = {
    fence: (node: any) => {
      const code = node.content ?? '';
      return <CodeBlock key={node.key} code={code} colors={colors} />;
    },
  };

  const responseActionsVisible = !isUser && !isStreaming && message.content.trim() !== '';
  const userActionsVisible = isUser && actionsVisible && !isStreaming && message.content.trim() !== '';
  const showPipelinePrelude = !isUser && (Boolean(leadText) || Boolean(statusText));

  const actionColor = copied ? colors.success : colors.textMuted;

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.aiContainer,
        userActionsVisible && styles.containerWithFloatingActions,
      ]}
    >
      <View
        style={[
          styles.messageWrap,
          isUser ? styles.userMessageWrap : styles.aiMessageWrap,
        ]}
      >
        <Pressable
          onLongPress={isUser ? onLongPress : undefined}
          delayLongPress={250}
          onPress={userActionsVisible ? onDismissActions : undefined}
        >
          <View
            style={[
              styles.bubble,
              isUser ? styles.userBubble : styles.aiBubble,
              isUser ? styles.userBubbleWidth : styles.aiBubbleWidth,
              { backgroundColor: isUser ? colors.userBubble : 'transparent' },
            ]}
          >
            {showPipelinePrelude ? (
              <View style={styles.pipelinePrelude}>
                {leadText ? (
                  <Text
                    style={[
                      styles.pipelineLead,
                      { color: colors.textSecondary, fontFamily: FONTS.sansSemiBold },
                    ]}
                  >
                    {leadText}
                  </Text>
                ) : null}
                {statusText ? (
                  <Text
                    style={[
                      styles.pipelineStatus,
                      { color: colors.textMuted, fontFamily: FONTS.sans },
                    ]}
                  >
                    {statusText}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {message.content.trim() !== '' ? (
              <View>
                {segments.map((segment, index) => {
                  if (!isTableSegment(segment)) {
                    return (
                      <Markdown key={`markdown-${index}`} style={markdownStyles} rules={renderRules}>
                        {segment.content}
                      </Markdown>
                    );
                  }

                  return (
                    <RichTable
                      key={`table-${index}`}
                      header={segment.header}
                      rows={segment.rows}
                      colors={colors}
                      isUser={isUser}
                    />
                  );
                })}
              </View>
            ) : isStreaming ? (
              <TypingDots colors={colors} />
            ) : null}
          </View>
        </Pressable>

        {responseActionsVisible && (
          <View style={styles.inlineActions}>
            <TouchableOpacity onPress={handleCopy} style={styles.inlineActionButton} hitSlop={8}>
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={17}
                color={actionColor}
              />
            </TouchableOpacity>
            {onPlay ? (
              <TouchableOpacity onPress={handlePlay} style={styles.inlineActionButton} hitSlop={8}>
                <Ionicons
                  name={isPlaying ? 'stop-circle-outline' : 'volume-high-outline'}
                  size={17}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={handleRegenerate} style={styles.inlineActionButton} hitSlop={8}>
              <Ionicons
                name="refresh-outline"
                size={17}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        )}

        {userActionsVisible && (
          <View style={styles.floatingActions}>
            <TouchableOpacity onPress={handleCopy} style={styles.inlineActionButton} hitSlop={8}>
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={17}
                color={actionColor}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEdit} style={styles.inlineActionButton} hitSlop={8}>
              <Ionicons
                name="create-outline"
                size={17}
                color={colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRegenerate} style={styles.inlineActionButton} hitSlop={8}>
              <Ionicons
                name="refresh-outline"
                size={17}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const CodeBlock: React.FC<{ code: string; colors: any }> = ({ code, colors }) => {
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

const RichTable: React.FC<{
  header: string[];
  rows: string[][];
  colors: ThemeColors;
  isUser: boolean;
}> = ({ header, rows, colors, isUser }) => {
  const textColor = isUser ? colors.userBubbleText : colors.aiBubbleText;
  const mutedTextColor = isUser ? 'rgba(255,255,255,0.75)' : colors.textMuted;
  const borderColor = isUser ? 'rgba(255,255,255,0.16)' : colors.border;
  const headerBackground = isUser ? 'rgba(255,255,255,0.08)' : colors.surfaceAlt;
  const rowBackground = isUser ? 'rgba(255,255,255,0.03)' : colors.surface;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tableStyles.scrollContent}
      style={tableStyles.scroll}
    >
      <View
        style={[
          tableStyles.table,
          {
            borderColor,
            backgroundColor: rowBackground,
          },
        ]}
      >
        <View
          style={[
            tableStyles.row,
            tableStyles.headerRow,
            {
              borderBottomColor: borderColor,
              backgroundColor: headerBackground,
            },
          ]}
        >
          {header.map((cell, index) => (
            <View
              key={`header-${index}`}
              style={[
                tableStyles.cell,
                index < header.length - 1 && { borderRightColor: borderColor, borderRightWidth: 1 },
              ]}
            >
              <Text style={[tableStyles.headerText, { color: textColor }]} selectable>
                {cell || ' '}
              </Text>
            </View>
          ))}
        </View>

        {rows.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[
              tableStyles.row,
              rowIndex < rows.length - 1 && { borderBottomColor: borderColor, borderBottomWidth: 1 },
            ]}
          >
            {row.map((cell, cellIndex) => (
              <View
                key={`cell-${rowIndex}-${cellIndex}`}
                style={[
                  tableStyles.cell,
                  cellIndex < row.length - 1 && { borderRightColor: borderColor, borderRightWidth: 1 },
                ]}
              >
                <Text style={[tableStyles.cellText, { color: cell ? textColor : mutedTextColor }]} selectable>
                  {cell || '-'}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const TypingDots: React.FC<{ colors: any }> = ({ colors }) => (
  <View style={styles.typingRow}>
    {[0, 1, 2].map((index) => (
      <View
        key={index}
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
  containerWithFloatingActions: {
    marginBottom: 34,
  },
  userContainer: {
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  aiContainer: {
    justifyContent: 'flex-start',
    paddingHorizontal: 10,
  },
  messageWrap: {
    position: 'relative',
  },
  userMessageWrap: {
    maxWidth: '84%',
    alignItems: 'stretch',
  },
  aiMessageWrap: {
    flex: 1,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 8,
  },
  pipelinePrelude: {
    gap: 4,
    marginBottom: 8,
  },
  pipelineLead: {
    fontSize: 14,
    lineHeight: 20,
  },
  pipelineStatus: {
    fontSize: 14,
    lineHeight: 20,
  },
  userBubbleWidth: {
    alignSelf: 'flex-end',
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
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    alignSelf: 'flex-start',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 10,
  },
  floatingActions: {
    position: 'absolute',
    top: '100%',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'nowrap',
    gap: 10,
    paddingHorizontal: 0,
    marginTop: 4,
  },
  inlineActionButton: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
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

const tableStyles = StyleSheet.create({
  scroll: {
    marginVertical: 10,
  },
  scrollContent: {
    paddingRight: 8,
  },
  table: {
    minWidth: '100%',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  headerRow: {
    borderBottomWidth: 1,
  },
  cell: {
    minWidth: 120,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.sansSemiBold,
  },
  cellText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.sans,
  },
});
