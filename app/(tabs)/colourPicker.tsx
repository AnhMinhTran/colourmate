import * as ImagePicker from 'expo-image-picker';
import { Asset } from 'expo-asset';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import {
  CursorPosition,
  getCenteredCursorPosition,
  getClampedCursorPosition,
  getCursorCenterPosition,
  ImageBounds,
  mapFramePointToSourcePixel,
} from '@/src/colour/services/colourPickerService';
import { SRGB } from '@/src/colour/services/colourConversion';

type GLResources = {
  framebuffer: WebGLFramebuffer | null;
  imageTexture: WebGLTexture | null;
  positionBuffer: WebGLBuffer | null;
  program: WebGLProgram | null;
  renderTexture: WebGLTexture | null;
  texCoordBuffer: WebGLBuffer | null;
  textureUniformLocation: WebGLUniformLocation | null;
};

const DEFAULT_BOUNDS: ImageBounds = { width: 0, height: 0 };

function createShader(
  gl: ExpoWebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error('Failed to create shader.');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'Unknown shader compilation error.';
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}

function createProgram(gl: ExpoWebGLRenderingContext): GLResources {
  const vertexShader = createShader(
    gl,
    gl.VERTEX_SHADER,
    `
      attribute vec2 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;

      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        vTexCoord = aTexCoord;
      }
    `
  );

  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      varying vec2 vTexCoord;
      uniform sampler2D uTexture;

      void main() {
        gl_FragColor = texture2D(uTexture, vTexCoord);
      }
    `
  );

  const program = gl.createProgram();

  if (!program) {
    throw new Error('Failed to create GL program.');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? 'Unknown program link error.';
    gl.deleteProgram(program);
    throw new Error(info);
  }

  const positionBuffer = gl.createBuffer();
  const texCoordBuffer = gl.createBuffer();

  if (!positionBuffer || !texCoordBuffer) {
    throw new Error('Failed to create GL buffers.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    framebuffer: null,
    imageTexture: null,
    positionBuffer,
    program,
    renderTexture: null,
    texCoordBuffer,
    textureUniformLocation: gl.getUniformLocation(program, 'uTexture'),
  };
}

export default function ImagePickerExample() {
  const [image, setImage] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState(1);
  const [frameBounds, setFrameBounds] = useState<ImageBounds>(DEFAULT_BOUNDS);
  const [sourceBounds, setSourceBounds] = useState<ImageBounds>(DEFAULT_BOUNDS);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ x: 0, y: 0 });
  const [zoomScale, setZoomScale] = useState(1);
  const [sampledColour, setSampledColour] = useState<SRGB | null>(null);
  const [glContextReady, setGlContextReady] = useState(false);
  const [samplerReady, setSamplerReady] = useState(false);
  const cursorSize = 28;
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);
  const cursorX = useSharedValue(0);
  const cursorY = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const gestureStartY = useSharedValue(0);
  const scale = useSharedValue(1);
  const scaleStart = useSharedValue(1);
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const glResourcesRef = useRef<GLResources | null>(null);

  const syncCursorPosition = useCallback((x: number, y: number) => {
    setCursorPosition({ x, y });
  }, []);

  const syncZoomScale = useCallback((nextScale: number) => {
    setZoomScale(nextScale);
  }, []);

  const prepareImageSampler = useCallback(
    async (uri: string, bounds: ImageBounds) => {
      const gl = glRef.current;

      if (!gl) {
        return;
      }

      if (!glResourcesRef.current) {
        glResourcesRef.current = createProgram(gl);
      }

      const resources = glResourcesRef.current;

      if (!resources.program || !resources.positionBuffer || !resources.texCoordBuffer) {
        return;
      }

      const asset = Asset.fromURI(uri);
      await asset.downloadAsync();
      setSamplerReady(false);

      if (resources.imageTexture) {
        gl.deleteTexture(resources.imageTexture);
      }

      if (resources.renderTexture) {
        gl.deleteTexture(resources.renderTexture);
      }

      if (resources.framebuffer) {
        gl.deleteFramebuffer(resources.framebuffer);
      }

      const imageTexture = gl.createTexture();
      const renderTexture = gl.createTexture();
      const framebuffer = gl.createFramebuffer();

      if (!imageTexture || !renderTexture || !framebuffer) {
        throw new Error('Failed to allocate GL textures.');
      }

      resources.imageTexture = imageTexture;
      resources.renderTexture = renderTexture;
      resources.framebuffer = framebuffer;

      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        asset as unknown as TexImageSource
      );

      gl.bindTexture(gl.TEXTURE_2D, renderTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        bounds.width,
        bounds.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        renderTexture,
        0
      );

      gl.viewport(0, 0, bounds.width, bounds.height);
      gl.useProgram(resources.program);

      const positionLocation = gl.getAttribLocation(resources.program, 'aPosition');
      const texCoordLocation = gl.getAttribLocation(resources.program, 'aTexCoord');

      gl.bindBuffer(gl.ARRAY_BUFFER, resources.positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, resources.texCoordBuffer);
      gl.enableVertexAttribArray(texCoordLocation);
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.uniform1i(resources.textureUniformLocation, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.flush();
      setSamplerReady(true);
    },
    []
  );

  const sampleCursorColour = useCallback(() => {
    const gl = glRef.current;
    const resources = glResourcesRef.current;

    if (
      !gl ||
      !resources?.framebuffer ||
      !frameBounds.width ||
      !frameBounds.height ||
      !sourceBounds.width ||
      !sourceBounds.height
    ) {
      return;
    }

    const centerPoint = getCursorCenterPosition(cursorPosition, cursorSize);
    const sourcePixel = mapFramePointToSourcePixel(frameBounds, sourceBounds, centerPoint, zoomScale);
    const pixels = new Uint8Array(4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
    gl.readPixels(sourcePixel.x, sourcePixel.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    setSampledColour((previous) => {
      if (
        previous &&
        previous.r === pixels[0] &&
        previous.g === pixels[1] &&
        previous.b === pixels[2]
      ) {
        return previous;
      }

      return {
        r: pixels[0],
        g: pixels[1],
        b: pixels[2],
      };
    });
  }, [cursorPosition, cursorSize, frameBounds, sourceBounds, zoomScale]);

  useEffect(() => {
    if (!image || !glContextReady || !sourceBounds.width || !sourceBounds.height || !glRef.current) {
      return;
    }

    prepareImageSampler(image, sourceBounds)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to prepare GL sampler.';
        Alert.alert('GL Error', message);
      });
  }, [glContextReady, image, prepareImageSampler, sourceBounds]);

  useEffect(() => {
    if (!samplerReady) {
      return;
    }

    sampleCursorColour();
  }, [sampleCursorColour, samplerReady]);

  const handleContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    glRef.current = gl;
    setGlContextReady(true);
  }, []);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      gestureStartX.value = cursorX.value;
      gestureStartY.value = cursorY.value;
    })
    .onUpdate((event) => {
      const nextPosition = getClampedCursorPosition(
        { width: imageWidth.value, height: imageHeight.value },
        cursorSize,
        {
          x: gestureStartX.value + event.translationX,
          y: gestureStartY.value + event.translationY,
        }
      );

      cursorX.value = nextPosition.x;
      cursorY.value = nextPosition.y;
      runOnJS(syncCursorPosition)(nextPosition.x, nextPosition.y);
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      scaleStart.value = scale.value;
    })
    .onUpdate((event) => {
      const nextScale = scaleStart.value * event.scale;
      const clampedScale = Math.min(Math.max(nextScale, 1), 4);
      scale.value = clampedScale;
      runOnJS(syncZoomScale)(clampedScale);
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cursorX.value }, { translateY: cursorY.value }],
  }));

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleImageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    imageWidth.value = width;
    imageHeight.value = height;
    setFrameBounds({ width, height });
    const centeredPosition = getCenteredCursorPosition({ width, height }, cursorSize);
    cursorX.value = centeredPosition.x;
    cursorY.value = centeredPosition.y;
    setCursorPosition(centeredPosition);
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access the media library is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      const selectedImage = result.assets[0];

      imageWidth.value = 0;
      imageHeight.value = 0;
      cursorX.value = 0;
      cursorY.value = 0;
      scale.value = 1;
      setZoomScale(1);
      setSampledColour(null);
      setSamplerReady(false);
      if (selectedImage.width && selectedImage.height) {
        setImageAspectRatio(selectedImage.width / selectedImage.height);
        setSourceBounds({
          width: selectedImage.width,
          height: selectedImage.height,
        });
      }
      setImage(selectedImage.uri);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Pick an image from camera roll" onPress={pickImage} />
      {image && (
        <GestureDetector gesture={composedGesture}>
          <View style={styles.imageFrame}>
            <Animated.View style={zoomStyle}>
              <Image
                source={{ uri: image }}
                style={[styles.image, { aspectRatio: imageAspectRatio }]}
                onLayout={handleImageLayout}
              />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[styles.cursor, { width: cursorSize, height: cursorSize }, animatedStyle]}
            />
            <View style={styles.previewCard}>
              <View
                style={[
                  styles.previewSwatch,
                  sampledColour
                    ? {
                        backgroundColor: `rgb(${sampledColour.r}, ${sampledColour.g}, ${sampledColour.b})`,
                      }
                    : styles.previewSwatchEmpty,
                ]}
              />
              <Text style={styles.previewText}>
                {sampledColour
                  ? `RGB(${sampledColour.r}, ${sampledColour.g}, ${sampledColour.b})`
                  : 'Sampling...'}
              </Text>
            </View>
          </View>
        </GestureDetector>
      )}
      {image && <GLView style={styles.hiddenGlView} onContextCreate={handleContextCreate} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  imageFrame: {
    position: 'relative',
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    borderRadius: 12,
  },
  cursor: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  previewCard: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    alignItems: 'center',
  },
  previewSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  previewSwatchEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  previewText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  hiddenGlView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
  },
});
