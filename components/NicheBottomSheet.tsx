import React from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    Text,
    ScrollView,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/theme';
import { NICHES, RELIGIONS } from '@/constants/niches';
import { NicheId, Religion } from '@/types';
import { logError } from '@/utils/logger';

const { height: screenHeight } = Dimensions.get('window');
const SHEET_HEIGHT = screenHeight * 0.7; // 70% of screen

interface Props {
    visible: boolean;
    onClose: () => void;
}

export const NicheBottomSheet: React.FC<Props> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { nicheId, setNiche, religion, setReligion, createChat, setCustomPersonaSheetOpen } = useAppStore();
    const selectedNiche = NICHES.find((niche) => niche.id === nicheId);

    const getBadges = (id: NicheId) => {
        const badges: string[] = ['Private'];

        if (id === 'raw' || id === 'darkweb') {
            badges.unshift('Unfiltered');
        }

        if (id === 'religion') {
            badges.unshift('Guided');
        }

        return badges;
    };

    const handleNicheSelect = (id: NicheId) => {
        if (id === 'custom') {
            setNiche('custom');
            onClose();
            setCustomPersonaSheetOpen(true);
            return;
        }
        try {
            setNiche(id);
            if (id !== 'religion') {
                createChat(id);
                onClose();
            }
        } catch (error) {
            logError('Failed to switch niche', error);
        }
    };

    const handleReligionSelect = (r: Religion) => {
        try {
            setReligion(r);
            createChat('religion', r);
            onClose();
        } catch (error) {
            logError('Failed to switch religion niche', error);
        }
    };

    if (!visible) {
        return null;
    }

    return (
        <View style={styles.overlay}>
            <Pressable style={styles.backdrop} onPress={onClose} />

            <View
                style={[
                    styles.sheet,
                    {
                        height: SHEET_HEIGHT,
                        backgroundColor: colors.background,
                        borderTopColor: colors.border,
                        paddingBottom: insets.bottom,
                    },
                ]}
            >
                <View
                    style={[
                        styles.header,
                        {
                            borderBottomColor: colors.border,
                            backgroundColor: colors.surface,
                        },
                    ]}
                >
                    <Pressable
                        onPress={onClose}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[styles.closeButton, { backgroundColor: colors.background }]}
                    >
                        <Ionicons name="close" size={18} color={colors.text} />
                    </Pressable>
                    <Text
                        style={[
                            styles.headerTitle,
                            {
                                color: colors.text,
                                fontFamily: FONTS.serifMedium,
                            },
                        ]}
                    >
                        Modes
                    </Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                >


                    <View style={styles.featuredWrap}>
                        <View style={[styles.featuredCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                            <View style={styles.featuredIconWrap}>
                                <Text style={styles.featuredIcon}>{selectedNiche?.icon ?? '⚡'}</Text>
                            </View>
                            <View style={styles.featuredContent}>
                                <Text style={[styles.featuredTitle, { color: colors.text, fontFamily: FONTS.sansSemiBold }]}>
                                    Auto
                                </Text>
                                <Text style={[styles.featuredDesc, { color: colors.textMuted, fontFamily: FONTS.sans }]}>
                                    Selects the best mode based on prompt
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.modeList}>
                        {NICHES.map((niche) => {
                            const isSelected = nicheId === niche.id;
                            const badges = getBadges(niche.id);

                            return (
                                <View
                                    key={niche.id}
                                    style={[
                                        styles.modeGroup,
                                        {
                                            borderBottomColor: colors.border,
                                            backgroundColor: isSelected ? colors.surfaceAlt : colors.background,
                                        },
                                    ]}
                                >
                                    <Pressable
                                        onPress={() => handleNicheSelect(niche.id)}
                                        style={styles.modeRow}
                                    >
                                        <View style={styles.modeLeft}>
                                            <View style={[styles.modeIconWrap, { backgroundColor: colors.surface }]}>
                                                <Text style={styles.modeIcon}>{niche.icon}</Text>
                                            </View>
                                            <View style={styles.modeTextWrap}>
                                                <View style={styles.modeTitleRow}>
                                                    <Text
                                                        style={[
                                                            styles.modeTitle,
                                                            {
                                                                color: colors.text,
                                                                fontFamily: FONTS.sansSemiBold,
                                                            },
                                                        ]}
                                                    >
                                                        {niche.persona}
                                                    </Text>
                                                    <Ionicons
                                                        name="information-circle"
                                                        size={14}
                                                        color={colors.textMuted}
                                                    />
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.modeSubtitle,
                                                        {
                                                            color: colors.textMuted,
                                                            fontFamily: FONTS.sans,
                                                        },
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {niche.description}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.badgeWrap}>
                                            {badges.map((badge) => (
                                                <View
                                                    key={`${niche.id}-${badge}`}
                                                    style={[
                                                        styles.badge,
                                                        {
                                                            backgroundColor:
                                                                badge === 'Unfiltered'
                                                                    ? '#DDF8F8'
                                                                    : badge === 'Guided'
                                                                        ? '#EEF2FF'
                                                                        : '#F3E8FF',
                                                        },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.badgeText,
                                                            {
                                                                color:
                                                                    badge === 'Unfiltered'
                                                                        ? '#0F766E'
                                                                        : badge === 'Guided'
                                                                            ? '#4F46E5'
                                                                            : '#9333EA',
                                                            },
                                                        ]}
                                                    >
                                                        {badge}
                                                    </Text>
                                                </View>
                                            ))}
                                            {isSelected && (
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={18}
                                                    color={colors.accent}
                                                />
                                            )}
                                        </View>
                                    </Pressable>

                                    {niche.id === 'religion' && nicheId === 'religion' && (
                                        <View style={styles.inlineReligionWrap}>
                                            {RELIGIONS.map((r) => {
                                                const isReligionSelected = religion === r.id;
                                                return (
                                                    <Pressable
                                                        key={r.id}
                                                        onPress={() => handleReligionSelect(r.id)}
                                                        style={[
                                                            styles.inlineReligionChip,
                                                            {
                                                                backgroundColor: isReligionSelected
                                                                    ? colors.accentLight
                                                                    : colors.surface,
                                                                borderColor: isReligionSelected
                                                                    ? colors.accent
                                                                    : colors.border,
                                                            },
                                                        ]}
                                                    >
                                                        <Text style={styles.inlineReligionFlag}>{r.flag}</Text>
                                                        <Text
                                                            style={[
                                                                styles.inlineReligionLabel,
                                                                {
                                                                    color: isReligionSelected
                                                                        ? colors.accent
                                                                        : colors.textSecondary,
                                                                    fontFamily: FONTS.sansMedium,
                                                                },
                                                            ]}
                                                            numberOfLines={1}
                                                        >
                                                            {r.label}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>

                    <View style={{ height: 16 }} />
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        zIndex: 120,
    },

    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },

    sheet: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },

    headerTitle: {
        fontSize: 18,
        letterSpacing: -0.4,
    },

    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },

    headerSpacer: {
        width: 32,
        height: 32,
    },

    content: {
        flex: 1,
    },

    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 12,
    },

    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },

    filterText: {
        fontSize: 13,
    },

    filterActions: {
        marginLeft: 'auto',
        flexDirection: 'row',
        gap: 14,
        paddingRight: 4,
    },

    featuredWrap: {
        paddingHorizontal: 10,
        paddingBottom: 8,
        paddingTop: 8,
    },

    featuredCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 12,
    },

    featuredIconWrap: {
        width: 34,
        alignItems: 'center',
    },

    featuredIcon: {
        fontSize: 22,
    },

    featuredContent: {
        flex: 1,
    },

    featuredTitle: {
        fontSize: 15,
        marginBottom: 3,
    },

    featuredDesc: {
        fontSize: 12,
        lineHeight: 16,
    },

    modeList: {
        paddingTop: 4,
    },

    modeGroup: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },

    modeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },

    modeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 10,
    },

    modeIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },

    modeIcon: {
        fontSize: 18,
    },

    modeTextWrap: {
        flex: 1,
    },

    modeTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 3,
    },

    modeTitle: {
        fontSize: 15,
    },

    modeSubtitle: {
        fontSize: 12,
        lineHeight: 16,
    },

    badgeWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        maxWidth: '42%',
    },

    badge: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },

    badgeText: {
        fontSize: 10,
        fontWeight: '600',
    },

    inlineReligionWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 58,
        paddingBottom: 14,
        paddingTop: 2,
    },

    inlineReligionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },

    inlineReligionFlag: {
        fontSize: 13,
    },

    inlineReligionLabel: {
        fontSize: 12,
        letterSpacing: -0.2,
        flexShrink: 0,
    },
});
