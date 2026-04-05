import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONTS, LIGHT_THEME } from '@/constants/theme';
import { getRuntimeLogs, logError } from '@/utils/logger';
import { toErrorMessage } from '@/utils/safe';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logError('React render crash', error, errorInfo.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const latestLog = getRuntimeLogs().slice(-1)[0];

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {toErrorMessage(this.state.error, 'The app hit an unexpected rendering error.')}
          </Text>
          {latestLog?.message ? (
            <Text style={styles.logLine} numberOfLines={4}>
              Latest log: {latestLog.message}
            </Text>
          ) : null}
          <TouchableOpacity onPress={this.handleRetry} style={styles.button}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LIGHT_THEME.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: LIGHT_THEME.background,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 12,
    color: LIGHT_THEME.text,
    fontFamily: FONTS.serifMedium,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: LIGHT_THEME.textSecondary,
    fontFamily: FONTS.sans,
  },
  logLine: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: LIGHT_THEME.textMuted,
    fontFamily: FONTS.sans,
  },
  button: {
    marginTop: 24,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: LIGHT_THEME.text,
  },
  buttonText: {
    color: LIGHT_THEME.background,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
  },
});
