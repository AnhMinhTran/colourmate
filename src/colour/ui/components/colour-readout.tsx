import { StyleSheet, Text, View } from 'react-native';

import { rgbToHex } from '@/src/colour/services/colourPickerService';
import { RGB } from '@/src/colour/ui/types';

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
    backgroundColor: '#222',
    borderRadius: 10,
    width: '90%',
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  hexText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  rgbText: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
});
