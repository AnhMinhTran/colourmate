import { StyleSheet, View } from 'react-native';

export function PickerCursor() {
  return (
    <View style={styles.cursor} pointerEvents="none">
      <View style={styles.crossH} />
      <View style={styles.crossV} />
    </View>
  );
}

const styles = StyleSheet.create({
  cursor: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 24,
    height: 24,
    marginTop: -12,
    marginLeft: -12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossH: {
    position: 'absolute',
    width: 20,
    height: 1.5,
    backgroundColor: '#fff',
  },
  crossV: {
    position: 'absolute',
    width: 1.5,
    height: 20,
    backgroundColor: '#fff',
  },
});
