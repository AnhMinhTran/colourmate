import { StyleSheet, Text, View } from 'react-native';

import { rgbToHex } from '@/src/colour/services/colourPickerService';
import { RGB } from '@/src/colour/ui/types';
import { AppColors } from '@/src/ui/constants/theme';

interface Props {
  colour: RGB;
}

export function ColourReadout({ colour }: Props) {
  const hex = rgbToHex(colour);
  return (
    <View style={styles.readout}>
      <View style={[styles.swatch, { backgroundColor: hex }]} />
      <View>
        <Text style={styles.hexText}>{hex}</Text>
        <Text style={styles.rgbText}>
          R {colour.r}   G {colour.g}   B {colour.b}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: AppColors.card,
    borderRadius: 10,
    width: '90%',
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  hexText: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  rgbText: {
    color: AppColors.muted,
    fontSize: 12,
    marginTop: 2,
  },
});
