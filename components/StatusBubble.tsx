/**
 * StatusBubble — shows live web search pipeline status
 *
 * Appears below the last message when web search is active.
 * Shows current status step with a pulsing indicator.
 * Disappears when streaming answer begins.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';

interface Props {
  message: string | null; // null = hidden
}

export const StatusBubble: React.FC<Props> = ({ message }) => {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    if (message) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      pulseLoop.start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      pulseLoop.stop();
      fadeAnim.stopAnimation();
      pulseAnim.stopAnimation();
    };
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim },
      ]}
    >
      <View style={styles.row}>
        {/* Pulsing dot */}
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: colors.accent,
              opacity: pulseAnim,
            },
          ]}
        />
        <Text
          style={[
            styles.text,
            { color: colors.textSecondary, fontFamily: FONTS.sans },
          ]}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
});
