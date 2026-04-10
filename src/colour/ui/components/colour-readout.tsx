import { StyleSheet, Text, View } from 'react-native';

import { rgbToHex } from '@/src/colour/services/colourPickerService';
import { RGB } from '@/src/colour/ui/types';
import { BG_CARD, BORDER_DEFAULT, SWATCH_BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/src/ui/constants/theme';

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
    backgroundColor: BG_CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    width: '90%',
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SWATCH_BORDER,
  },
  hexText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: 'Inter_SemiBold',
  },
  rgbText: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'Inter',
  },
});
