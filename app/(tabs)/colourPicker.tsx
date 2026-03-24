import { Asset } from 'expo-asset';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import { Alert, Button, Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MIN_SCALE = 1;
const MAX_SCALE = 8;

// ── Shaders ───────────────────────────────────────────────────────────────────
// Renders a fullscreen quad. Fragment shader undoes the contain + user transform
// to sample the correct texel, matching what AnimatedImage displays.
const VERT = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = vec2(a_pos.x * 0.5 + 0.5, -a_pos.y * 0.5 + 0.5);
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAG = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_image;
  uniform vec2  u_containOffset; // letterbox/pillarbox offset in UV space
  uniform vec2  u_containScale;  // image footprint in UV space
  uniform float u_scale;         // user zoom
  uniform vec2  u_translate;     // user pan in UV space

  void main() {
    // Undo user transform (scale around centre, then translate)
    vec2 pre = (v_uv - u_translate - 0.5) / u_scale + 0.5;
    // Undo contain transform
    vec2 texUV = (pre - u_containOffset) / u_containScale;

    if (pre.x    < 0.0 || pre.x    > 1.0 ||
        pre.y    < 0.0 || pre.y    > 1.0 ||
        texUV.x  < 0.0 || texUV.x  > 1.0 ||
        texUV.y  < 0.0 || texUV.y  > 1.0) {
      gl_FragColor = vec4(0.133, 0.133, 0.133, 1.0);
    } else {
      gl_FragColor = texture2D(u_image, texUV);
    }
  }
`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ImageInfo { uri: string; width: number; height: number }
interface RGB { r: number; g: number; b: number }

const AnimatedImage = Animated.createAnimatedComponent(Image);

// ── Component ─────────────────────────────────────────────────────────────────
export default function ColourPicker() {
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [sampledColor, setSampledColor] = useState<RGB | null>(null);

  const containerSizeRef = useRef({ width: 300, height: 225 });

  // GL refs — populated in onContextCreate
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const uScaleRef = useRef<WebGLUniformLocation | null>(null);
  const uTranslateRef = useRef<WebGLUniformLocation | null>(null);
  const uContainOffsetRef = useRef<WebGLUniformLocation | null>(null);
  const uContainScaleRef = useRef<WebGLUniformLocation | null>(null);
  const containRef = useRef({ offset: [0, 0], scale: [1, 1] });

  // ── Gesture shared values ─────────────────────────────────────────────────
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // ── GL render + pixel read (JS thread) ───────────────────────────────────
  const renderAndSample = useCallback((s: number, tx: number, ty: number) => {
    const gl = glRef.current;
    if (!gl) return;

    const { width: cW, height: cH } = containerSizeRef.current;
    const [cOffX, cOffY] = containRef.current.offset;
    const [cSclX, cSclY] = containRef.current.scale;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.133, 0.133, 0.133, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uScaleRef.current, s);
    gl.uniform2f(uTranslateRef.current, tx / cW, ty / cH);
    gl.uniform2f(uContainOffsetRef.current, cOffX, cOffY);
    gl.uniform2f(uContainScaleRef.current, cSclX, cSclY);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Read centre pixel before presenting the frame
    const cx = Math.floor(gl.drawingBufferWidth / 2);
    const cy = Math.floor(gl.drawingBufferHeight / 2);
    const buf = new Uint8Array(4);
    gl.readPixels(cx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    setSampledColor({ r: buf[0], g: buf[1], b: buf[2] });

    gl.endFrameEXP();
  }, []);

  // ── Gestures ──────────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
      scheduleOnRN(renderAndSample, scale.value, translateX.value, translateY.value);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(MIN_SCALE, Math.min(savedScale.value * e.scale, MAX_SCALE));
      scheduleOnRN(renderAndSample, scale.value, translateX.value, translateY.value);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const gesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // ── GL setup ──────────────────────────────────────────────────────────────
  const onContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    glRef.current = gl;
    if (!imageInfo) return;

    try {
      const makeShader = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      const program = gl.createProgram()!;
      gl.attachShader(program, makeShader(gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, makeShader(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      gl.useProgram(program);

      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, 'a_pos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      uScaleRef.current = gl.getUniformLocation(program, 'u_scale');
      uTranslateRef.current = gl.getUniformLocation(program, 'u_translate');
      uContainOffsetRef.current = gl.getUniformLocation(program, 'u_containOffset');
      uContainScaleRef.current = gl.getUniformLocation(program, 'u_containScale');

      const asset = Asset.fromURI(imageInfo.uri);
      await asset.downloadAsync();
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, asset as any);

      // Compute the "contain" transform that matches resizeMode="contain"
      const { width: cW, height: cH } = containerSizeRef.current;
      const fitScale = Math.min(cW / imageInfo.width, cH / imageInfo.height);
      const scaledW = imageInfo.width * fitScale;
      const scaledH = imageInfo.height * fitScale;
      containRef.current = {
        offset: [(cW - scaledW) / 2 / cW, (cH - scaledH) / 2 / cH],
        scale: [scaledW / cW, scaledH / cH],
      };

      // Initial sample at centre with no user transform
      renderAndSample(1, 0, 0);
    } catch (err) {
      console.error('[ColourPicker] GL error:', err);
    }
  }, [imageInfo, renderAndSample]);

  // ── Image picker ──────────────────────────────────────────────────────────
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
      scale.value = 1; savedScale.value = 1;
      translateX.value = 0; translateY.value = 0;
      savedTranslateX.value = 0; savedTranslateY.value = 0;
      setSampledColor(null);
      setImageInfo({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  };

  const toHex = ({ r, g, b }: RGB) =>
    `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

  // ── Render ────────────────────────────────────────────────────────────────
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
            {/* Visible display — smooth UI-thread animation */}
            <GestureDetector gesture={gesture}>
              <AnimatedImage
                source={{ uri: imageInfo.uri }}
                style={[StyleSheet.absoluteFill, imageStyle]}
                resizeMode="contain"
              />
            </GestureDetector>

            {/* Hidden GL context — mirrors the same transform for readPixels */}
            <GLView
              key={imageInfo.uri}
              style={[StyleSheet.absoluteFill, styles.glHidden]}
              onContextCreate={onContextCreate}
              pointerEvents="none"
            />

            {/* Cursor fixed at centre */}
            <View style={styles.cursor} pointerEvents="none">
              <View style={styles.crossH} />
              <View style={styles.crossV} />
            </View>
          </View>

          {/* Colour readout */}
          {sampledColor && (
            <View style={styles.readout}>
              <View style={[styles.swatch, { backgroundColor: toHex(sampledColor) }]} />
              <View>
                <Text style={styles.hexText}>{toHex(sampledColor)}</Text>
                <Text style={styles.rgbText}>
                  R {sampledColor.r}   G {sampledColor.g}   B {sampledColor.b}
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
