import React, { useEffect } from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    Text,
    ScrollView,
    Dimensions,
    Platform,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    FadeIn,
    FadeOut,
    runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';
import { NICHES, RELIGIONS } from '@/constants/niches';
import { NicheId, Religion } from '@/types';

const { height: screenHeight } = Dimensions.get('window');
const SHEET_HEIGHT = screenHeight * 0.7; // 70% of screen
const CLOSED_Y = screenHeight;
const OPEN_Y = screenHeight * 0.3; // 30% from top

interface Props {
    visible: boolean;
    onClose: () => void;
}

export const NicheBottomSheet: React.FC<Props> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { nicheId, setNiche, religion, setReligion } = useAppStore();

    const translateY = useSharedValue(CLOSED_Y);
    const backdropOpacity = useSharedValue(0);

    // Animation: Open sheet
    useEffect(() => {
        if (visible) {
            translateY.value = withTiming(OPEN_Y, {
                duration: 300,
            });
            backdropOpacity.value = withTiming(1, {
                duration: 300,
            });
        } else {
            translateY.value = withTiming(CLOSED_Y, {
                duration: 250,
            });
            backdropOpacity.value = withTiming(0, {
                duration: 250,
            });
        }
    }, [visible]);

    const sheetAnimStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropAnimStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const handleNicheSelect = (id: NicheId) => {
        setNiche(id);
        if (id !== 'religion') {
            // Auto-close for non-religion niches
            setTimeout(() => onClose(), 150);
        }
        // For religion niche, keep sheet open to select religion
    };

    const handleReligionSelect = (r: Religion) => {
        setReligion(r);
        setTimeout(() => onClose(), 150);
    };

    if (!visible && backdropOpacity.value === 0) {
        return null;
    }

    return (
        <>
            {/* Backdrop */}
            <Animated.View
                style={[styles.backdrop, backdropAnimStyle]}
                pointerEvents={visible ? 'auto' : 'none'}
            >
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    hitSlop={0}
                />
            </Animated.View>

            {/* Bottom Sheet */}
            <Animated.View
                style={[
                    styles.sheet,
                    {
                        height: SHEET_HEIGHT,
                        backgroundColor: colors.background,
                        borderTopColor: colors.border,
                    },
                    sheetAnimStyle,
                ]}
                pointerEvents={visible ? 'auto' : 'none'}
            >
                {/* Header */}
                <View
                    style={[
                        styles.header,
                        {
                            borderBottomColor: colors.border,
                            paddingTop: insets.top || 16,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.headerTitle,
                            {
                                color: colors.text,
                                fontFamily: FONTS.serifMedium,
                            },
                        ]}
                    >
                        Choose a Persona
                    </Text>
                    <Pressable
                        onPress={onClose}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="close" size={24} color={colors.text} />
                    </Pressable>
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={true}
                    scrollEventThrottle={16}
                >
                    {/* Niches Grid */}
                    <View style={styles.nicheGrid}>
                        {NICHES.map((niche) => {
                            const isSelected = nicheId === niche.id;
                            const isReligionSelected = niche.id === 'religion' && nicheId === 'religion';

                            return (
                                <Pressable
                                    key={niche.id}
                                    onPress={() => handleNicheSelect(niche.id)}
                                    style={[
                                        styles.nicheCard,
                                        {
                                            backgroundColor: isSelected
                                                ? colors.surfaceAlt
                                                : colors.surface,
                                            borderColor: isSelected ? colors.text : colors.border,
                                            borderWidth: isSelected ? 2 : 1,
                                        },
                                    ]}
                                >
                                    <Text style={styles.nicheIcon}>{niche.icon}</Text>
                                    <Text
                                        style={[
                                            styles.nicheLabel,
                                            {
                                                color: colors.text,
                                                fontFamily: FONTS.sansMedium,
                                                fontWeight: isSelected ? '600' : '500',
                                            },
                                        ]}
                                    >
                                        {niche.label}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.nicheDesc,
                                            {
                                                color: colors.textMuted,
                                                fontFamily: FONTS.sans,
                                            },
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {niche.description}
                                    </Text>
                                    {isSelected && (
                                        <View style={styles.checkmark}>
                                            <Ionicons
                                                name="checkmark-circle-sharp"
                                                size={20}
                                                color={colors.text}
                                            />
                                        </View>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Religion Sub-Options (only show when religion is selected) */}
                    {nicheId === 'religion' && (
                        <View style={styles.religiousOptions}>
                            <Text
                                style={[
                                    styles.subheader,
                                    {
                                        color: colors.text,
                                        fontFamily: FONTS.serifMedium,
                                    },
                                ]}
                            >
                                Select Religion
                            </Text>
                            <View style={styles.religionGrid}>
                                {RELIGIONS.map((r) => {
                                    const isReligionSelected = religion === r.id;
                                    return (
                                        <Pressable
                                            key={r.id}
                                            onPress={() => handleReligionSelect(r.id)}
                                            style={[
                                                styles.religionCard,
                                                {
                                                    backgroundColor: isReligionSelected
                                                        ? colors.surfaceAlt
                                                        : colors.surface,
                                                    borderColor: isReligionSelected
                                                        ? colors.text
                                                        : colors.border,
                                                    borderWidth: isReligionSelected ? 2 : 1,
                                                },
                                            ]}
                                        >
                                            <Text style={styles.religionFlag}>{r.flag}</Text>
                                            <Text
                                                style={[
                                                    styles.religionLabel,
                                                    {
                                                        color: colors.text,
                                                        fontFamily: FONTS.sans,
                                                        fontWeight: isReligionSelected ? '600' : '500',
                                                    },
                                                ]}
                                            >
                                                {r.label}
                                            </Text>
                                            {isReligionSelected && (
                                                <Ionicons
                                                    name="checkmark"
                                                    size={16}
                                                    color={colors.text}
                                                    style={styles.religionCheck}
                                                />
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Bottom Padding */}
                    <View style={{ height: insets.bottom + 16 }} />
                </ScrollView>
            </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 99,
    },

    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        zIndex: 100,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },

    headerTitle: {
        fontSize: 18,
        letterSpacing: -0.4,
    },

    content: {
        flex: 1,
        paddingHorizontal: 12,
    },

    nicheGrid: {
        paddingVertical: 12,
        gap: 10,
    },

    nicheCard: {
        borderRadius: 12,
        padding: 12,
        marginVertical: 6,
        position: 'relative',
    },

    nicheIcon: {
        fontSize: 28,
        marginBottom: 8,
    },

    nicheLabel: {
        fontSize: 15,
        letterSpacing: -0.3,
        marginBottom: 4,
    },

    nicheDesc: {
        fontSize: 12,
        lineHeight: 16,
    },

    checkmark: {
        position: 'absolute',
        top: 12,
        right: 12,
    },

    religiousOptions: {
        marginTop: 20,
        paddingBottom: 12,
    },

    subheader: {
        fontSize: 16,
        letterSpacing: -0.3,
        marginBottom: 12,
        paddingHorizontal: 4,
    },

    religionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },

    religionCard: {
        flex: 0.48,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        minHeight: 80,
    },

    religionFlag: {
        fontSize: 24,
        marginBottom: 6,
    },

    religionLabel: {
        fontSize: 12,
        textAlign: 'center',
        letterSpacing: -0.2,
    },

    religionCheck: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
});
