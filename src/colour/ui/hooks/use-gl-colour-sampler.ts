import { Asset } from 'expo-asset';
import { ExpoWebGLRenderingContext } from 'expo-gl';
import { useCallback, useRef, useState } from 'react';
import { SharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { computeContainTransform } from '@/src/colour/services/colourPickerService';
import { ImageInfo, RGB } from '@/src/colour/ui/types';

// ── Shaders ───────────────────────────────────────────────────────────────────
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
  uniform vec2  u_containOffset;
  uniform vec2  u_containScale;
  uniform float u_scale;
  uniform vec2  u_translate;

  void main() {
    vec2 pre = (v_uv - u_translate - 0.5) / u_scale + 0.5;
    vec2 texUV = (pre - u_containOffset) / u_containScale;

    if (pre.x   < 0.0 || pre.x   > 1.0 ||
        pre.y   < 0.0 || pre.y   > 1.0 ||
        texUV.x < 0.0 || texUV.x > 1.0 ||
        texUV.y < 0.0 || texUV.y > 1.0) {
      gl_FragColor = vec4(0.133, 0.133, 0.133, 1.0);
    } else {
      gl_FragColor = texture2D(u_image, texUV);
    }
  }
`;

interface Props {
  imageInfo: ImageInfo | null;
  containerSizeRef: React.RefObject<{ width: number; height: number }>;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

export function useGlColourSampler({
  imageInfo,
  containerSizeRef,
  scale,
  translateX,
  translateY,
}: Props) {
  const [sampledColor, setSampledColor] = useState<RGB | null>(null);

  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const uScaleRef = useRef<WebGLUniformLocation | null>(null);
  const uTranslateRef = useRef<WebGLUniformLocation | null>(null);
  const uContainOffsetRef = useRef<WebGLUniformLocation | null>(null);
  const uContainScaleRef = useRef<WebGLUniformLocation | null>(null);
  const containRef = useRef({ offset: [0, 0], scale: [1, 1] });

  const renderAndSample = useCallback(
    (s: number, tx: number, ty: number) => {
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

      const cx = Math.floor(gl.drawingBufferWidth / 2);
      const cy = Math.floor(gl.drawingBufferHeight / 2);
      const buf = new Uint8Array(4);
      gl.readPixels(cx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      setSampledColor({ r: buf[0], g: buf[1], b: buf[2] });

      gl.endFrameEXP();
    },
    [containerSizeRef],
  );

  useAnimatedReaction(
    () => ({ s: scale.value, tx: translateX.value, ty: translateY.value }),
    ({ s, tx, ty }) => {
      scheduleOnRN(renderAndSample, s, tx, ty);
    },
  );

  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
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
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
          gl.STATIC_DRAW,
        );
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

        const contain = computeContainTransform(containerSizeRef.current, imageInfo);
        containRef.current = contain;

        renderAndSample(1, 0, 0);
      } catch (err) {
        console.error('[useGlColourSampler] GL error:', err);
      }
    },
    [imageInfo, containerSizeRef, renderAndSample],
  );

  return { onContextCreate, sampledColor };
}
