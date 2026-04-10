import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColourPoint } from '../../models/colourPoint';
import {
  ACCENT_GOLD,
  BG_CARD,
  BG_ELEVATED,
  BORDER_DEFAULT,
  SWATCH_BORDER,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/src/ui/constants/theme';

export function SpectrumSheet({
  visible,
  path,
  onClose,
}: {
  visible: boolean;
  path: ColourPoint[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (path.length < 2) return null;

  const a = path[0];
  const b = path[path.length - 1];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.panel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.heading}>Colour Spectrum</Text>
          <Pressable onPress={onClose}>
            <Text style={s.closeText}>Done</Text>
          </Pressable>
        </View>

        {/* Endpoints row */}
        <View style={s.endpointsRow}>
          <View style={s.endpoint}>
            <View style={[s.endpointSwatch, { backgroundColor: `rgb(${a.rgb.r},${a.rgb.g},${a.rgb.b})` }]} />
            <Text style={s.endpointLabel} numberOfLines={1}>A: {a.name}</Text>
            <Text style={s.endpointBrand} numberOfLines={1}>{a.brand}</Text>
          </View>
          <View style={s.arrow}>
            <View style={s.arrowLine} />
            <Text style={s.arrowHead}>{'\u203A'}</Text>
          </View>
          <View style={s.endpoint}>
            <View style={[s.endpointSwatch, { backgroundColor: `rgb(${b.rgb.r},${b.rgb.g},${b.rgb.b})` }]} />
            <Text style={s.endpointLabel} numberOfLines={1}>B: {b.name}</Text>
            <Text style={s.endpointBrand} numberOfLines={1}>{b.brand}</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>{path.length} colours across the spectrum</Text>

        {/* Spectrum swatches */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.swatchRow}
        >
          {path.map((c, i) => {
            const isEndpoint = i === 0 || i === path.length - 1;
            return (
              <Pressable
                key={c.id}
                style={s.swatchItem}
                onPress={() => router.push({ pathname: '/colour/[id]' as any, params: { id: c.id } })}
              >
                <View
                  style={[
                    s.swatch,
                    { backgroundColor: `rgb(${c.rgb.r},${c.rgb.g},${c.rgb.b})` },
                    isEndpoint && s.swatchEndpoint,
                  ]}
                />
                {isEndpoint && (
                  <View style={s.endpointDot}>
                    <Text style={s.endpointDotText}>{i === 0 ? 'A' : 'B'}</Text>
                  </View>
                )}
                <Text style={s.swatchName} numberOfLines={2}>{c.name}</Text>
                <Text style={s.swatchBrand} numberOfLines={1}>{c.brand}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    backgroundColor: BG_ELEVATED,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '65%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER_DEFAULT,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY, fontFamily: 'Inter_Bold' },
  closeText: { fontSize: 15, color: ACCENT_GOLD, fontWeight: '600', fontFamily: 'Inter_SemiBold' },
  endpointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  endpoint: { flex: 1, alignItems: 'center', gap: 4 },
  endpointSwatch: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: BORDER_DEFAULT,
  },
  endpointLabel: { fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'center', fontFamily: 'Inter_SemiBold' },
  endpointBrand: { fontSize: 11, color: TEXT_SECONDARY, textAlign: 'center', fontFamily: 'Inter' },
  arrow: { flexDirection: 'row', alignItems: 'center', width: 40 },
  arrowLine: { flex: 1, height: 1.5, backgroundColor: BORDER_DEFAULT },
  arrowHead: { fontSize: 22, color: BORDER_DEFAULT, marginLeft: -4, lineHeight: 24 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT_GOLD,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    fontFamily: 'Inter_SemiBold',
  },
  swatchRow: { gap: 10, paddingBottom: 4 },
  swatchItem: { width: 72, alignItems: 'center', gap: 4 },
  swatch: { width: 60, height: 60, borderRadius: 10, borderWidth: 1, borderColor: SWATCH_BORDER },
  swatchEndpoint: {
    borderWidth: 2.5,
    borderColor: ACCENT_GOLD,
  },
  endpointDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ACCENT_GOLD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endpointDotText: { fontSize: 10, fontWeight: '700', color: '#000' },
  swatchName: { fontSize: 11, color: TEXT_PRIMARY, textAlign: 'center', lineHeight: 14, fontFamily: 'Inter' },
  swatchBrand: { fontSize: 10, color: TEXT_SECONDARY, textAlign: 'center', fontFamily: 'Inter' },
});
