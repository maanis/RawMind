import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';
import { buildCustomPersonaPrompt } from '@/services/ai';

const { height: screenHeight } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const CustomPersonaSheet: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { setCustomPersonaPrompt, createChat, setNiche } = useAppStore();

  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState('');
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  if (!visible) return null;

  const handleClose = () => {
    setStep('input');
    setDescription('');
    setPreview('');
    setError('');
    onClose();
  };

  const handleBuild = async () => {
    if (!description.trim()) return;
    setBuilding(true);
    setError('');
    try {
      const refined = await buildCustomPersonaPrompt(description.trim());
      if (!refined) {
        setError('Could not build persona. Make sure backend + Ollama are running.');
        return;
      }
      setPreview(refined);
      setStep('preview');
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error');
    } finally {
      setBuilding(false);
    }
  };

  const handleActivate = () => {
    setCustomPersonaPrompt(preview);
    setNiche('custom');
    createChat('custom', undefined, preview);
    handleClose();
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kavWrapper}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }]}
            >
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
            <Text style={[styles.title, { color: colors.text, fontFamily: FONTS.serifMedium }]}>
              🎭 Build Your Persona
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 'input' ? (
              <>
                <Text style={[styles.label, { color: colors.textSecondary, fontFamily: FONTS.sans }]}>
                  Describe how the AI should behave. Be rough — the model refines it automatically.
                </Text>

                <TextInput
                  style={[
                    styles.textarea,
                    {
                      color: colors.text,
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      fontFamily: FONTS.sans,
                    },
                  ]}
                  multiline
                  placeholder={
                    'e.g. Act like a sarcastic 1800s pirate captain obsessed with treasure and the sea. Gets furious if asked anything else. Speaks in old English. Never breaks character.'
                  }
                  placeholderTextColor={colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  textAlignVertical="top"
                  maxLength={600}
                />

                {!!error && (
                  <Text style={[styles.errorText, { color: colors.danger, fontFamily: FONTS.sans }]}>
                    {error}
                  </Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.btn,
                    {
                      backgroundColor:
                        description.trim() && !building ? colors.text : colors.surfaceAlt,
                    },
                  ]}
                  onPress={handleBuild}
                  disabled={!description.trim() || building}
                >
                  {building ? (
                    <View style={styles.btnRow}>
                      <ActivityIndicator color={colors.background} size="small" />
                      <Text style={[styles.btnText, { color: colors.background, fontFamily: FONTS.sansSemiBold }]}>
                        Refining with AI...
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.btnText,
                        {
                          color: description.trim() ? colors.background : colors.textMuted,
                          fontFamily: FONTS.sansSemiBold,
                        },
                      ]}
                    >
                      Build Persona ✦
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.textSecondary, fontFamily: FONTS.sans }]}>
                  AI-refined system prompt — edit if needed before activating:
                </Text>

                <TextInput
                  style={[
                    styles.textarea,
                    styles.previewArea,
                    {
                      color: colors.text,
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.accent,
                      fontFamily: FONTS.mono,
                    },
                  ]}
                  multiline
                  value={preview}
                  onChangeText={setPreview}
                  textAlignVertical="top"
                />

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      styles.btnOutline,
                      { borderColor: colors.border, flex: 1 },
                    ]}
                    onPress={() => setStep('input')}
                  >
                    <Text style={[styles.btnText, { color: colors.text, fontFamily: FONTS.sansSemiBold }]}>
                      ← Redo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.text, flex: 2 }]}
                    onPress={handleActivate}
                    disabled={!preview.trim()}
                  >
                    <Text style={[styles.btnText, { color: colors.background, fontFamily: FONTS.sansSemiBold }]}>
                      Activate Persona →
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  kavWrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.88,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  body: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 140,
    fontSize: 15,
    marginBottom: 16,
    lineHeight: 22,
  },
  previewArea: {
    minHeight: 180,
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 19,
  },
  btn: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  btnOutline: {
    borderWidth: 1,
    marginRight: 8,
  },
  btnText: {
    fontSize: 15,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
