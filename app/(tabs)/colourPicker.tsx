import { GLView } from 'expo-gl';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Alert, Button, Image, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { ColourReadout } from '@/src/colour/ui/components/colour-readout';
import { PickerCursor } from '@/src/colour/ui/components/picker-cursor';
import { useGlColourSampler } from '@/src/colour/ui/hooks/use-gl-colour-sampler';
import { useImageTransform } from '@/src/colour/ui/hooks/use-image-transform';
import { ImageInfo } from '@/src/colour/ui/types';

const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function ColourPicker() {
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const containerSizeRef = useRef({ width: 300, height: 225 });

  const { gesture, imageStyle, scale, translateX, translateY, resetTransform } =
    useImageTransform();

  const { onContextCreate, sampledColor } = useGlColourSampler({
    imageInfo,
    containerSizeRef,
    scale,
    translateX,
    translateY,
  });

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Media library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      resetTransform();
      setImageInfo({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  };

  return (
    <View style={styles.screen}>
      <Button title="Pick Image" onPress={pickImage} />

      {imageInfo && (
        <>
          <View
            style={styles.container}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              containerSizeRef.current = { width, height };
            }}
          >
            <GestureDetector gesture={gesture}>
              <AnimatedImage
                source={{ uri: imageInfo.uri }}
                style={[StyleSheet.absoluteFill, imageStyle]}
                resizeMode="contain"
              />
            </GestureDetector>

            <GLView
              key={imageInfo.uri}
              style={[StyleSheet.absoluteFill, styles.glHidden]}
              onContextCreate={onContextCreate}
              pointerEvents="none"
            />

            <PickerCursor />
          </View>

          {sampledColor && <ColourReadout colour={sampledColor} />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  container: {
    width: '90%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#222',
  },
  glHidden: {
    opacity: 0,
  },
});
