import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColourFilter, EMPTY_FILTER } from '@/src/colour/services/colourQueryService';
import { AppColors } from '@/src/ui/constants/theme';

export function FilterSheet({
  visible,
  brands,
  filter,
  onApply,
  onClose,
}: {
  visible: boolean;
  brands: string[];
  filter: ColourFilter;
  onApply: (f: ColourFilter) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ColourFilter>(filter);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setDraft(filter);
  }, [visible, filter]);

  const toggleBrand = (brand: string) => {
    setDraft((prev) => {
      const next = new Set(prev.brands);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return { ...prev, brands: next };
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.panel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.heading}>Filters</Text>
          <Pressable onPress={() => setDraft(EMPTY_FILTER)}>
            <Text style={s.clearAll}>Clear all</Text>
          </Pressable>
        </View>
        <View style={s.row}>
          <Text style={s.rowLabel}>In inventory only</Text>
          <Switch
            value={draft.inInventoryOnly}
            onValueChange={(v) => setDraft((p) => ({ ...p, inInventoryOnly: v }))}
            trackColor={{ true: AppColors.interactive }}
          />
        </View>
        <Text style={s.sectionLabel}>Brand</Text>
        <ScrollView style={s.brandList} showsVerticalScrollIndicator={false}>
          {brands.map((brand) => {
            const selected = draft.brands.has(brand);
            return (
              <Pressable key={brand} style={s.brandRow} onPress={() => toggleBrand(brand)}>
                <View style={[s.checkbox, selected && s.checkboxActive]}>
                  {selected && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={s.brandLabel}>{brand}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={s.applyBtn} onPress={() => { onApply(draft); onClose(); }}>
          <Text style={s.applyBtnText}>Apply</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: { fontSize: 17, fontWeight: '700', color: AppColors.text },
  clearAll: { fontSize: 14, color: AppColors.interactive },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  rowLabel: { fontSize: 15, color: AppColors.text },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  brandList: { maxHeight: 280 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: AppColors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: AppColors.interactive, borderColor: AppColors.interactive },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  brandLabel: { fontSize: 15, color: AppColors.text },
  applyBtn: {
    backgroundColor: AppColors.interactive,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
