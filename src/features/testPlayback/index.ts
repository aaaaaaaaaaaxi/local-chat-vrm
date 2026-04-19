import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMAnimationLoaderPlugin } from "@pixiv/three-vrm-animation";
import { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import { Model } from "../vrmViewer/model";

interface ArkitFrame {
  weights: number[];
  time: number;
}

interface ArkitData {
  names: string[];
  metadata: { fps: number; frame_count: number };
  frames: ArkitFrame[];
}

interface BoneTrack {
  times: number[];
  values: number[]; // flat quaternions: [x0,y0,z0,w0, x1,y1,z1,w1, ...]
}

interface CachedRound {
  text: string;
  arkitData: ArkitData;
  boneTracks: Map<string, BoneTrack>;
  vrmaDuration: number;
  audioBuffer: ArrayBuffer;
}

const cache = new Map<number, CachedRound>();

/** Capitalize first letter: "mouthSmileLeft" → "MouthSmileLeft" */
function arkitToVRMName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Parse VRMA binary via VRMAnimationLoaderPlugin and extract bone rotation tracks.
 * Reference: three-vrm examples/expressions.html
 */
async function parseVrma(
  vrmaBuf: ArrayBuffer
): Promise<{ boneTracks: Map<string, BoneTrack>; duration: number }> {
  const url = URL.createObjectURL(
    new Blob([vrmaBuf], { type: "application/octet-stream" })
  );

  try {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const boneTracks = new Map<string, BoneTrack>();
          let duration = 0;

          const vrmAnimations = gltf.userData.vrmAnimations;
          if (vrmAnimations?.[0]) {
            const anim = vrmAnimations[0];
            duration = anim.duration ?? 0;

            if (anim.humanoidTracks?.rotation) {
              for (const [boneName, track] of anim.humanoidTracks.rotation.entries()) {
                if (track.times && track.values) {
                  boneTracks.set(boneName, {
                    times: Array.from(track.times as ArrayLike<number>),
                    values: Array.from(track.values as ArrayLike<number>),
                  });
                }
              }
            }
          }

          resolve({ boneTracks, duration });
        },
        undefined,
        reject
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

let preloadPromise: Promise<void> | null = null;

export function preloadAll(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    for (const round of [1, 2, 3]) {
      console.log(`Preloading round ${round}...`);

      const [textRes, arkitRes, vrmaRes, audioRes] = await Promise.all([
        fetch(`/test/text/test${round}.txt`),
        fetch(`/test/arkit/test${round}.json`),
        fetch(`/test/vrma/test${round}.vrma`),
        fetch(`/test/audio/test${round}.wav`),
      ]);

      const [text, arkitData, vrmaBuf, audioBuffer] = await Promise.all([
        textRes.text(),
        arkitRes.json() as Promise<ArkitData>,
        vrmaRes.arrayBuffer(),
        audioRes.arrayBuffer(),
      ]);

      const { boneTracks, duration: vrmaDuration } = await parseVrma(vrmaBuf);

      cache.set(round, {
        text: text.trim(),
        arkitData,
        boneTracks,
        vrmaDuration,
        audioBuffer,
      });
      console.log(
        `Round ${round} preloaded (${boneTracks.size} bone tracks, ${vrmaDuration.toFixed(2)}s)`
      );
    }
    console.log("All rounds preloaded");
  })();
  return preloadPromise;
}

/**
 * Apply VRMA bone rotations at a given time.
 * Sets quaternion directly on normalized/raw bone nodes, then calls
 * humanoid.update() to transfer the poses to the rendered skeleton.
 */
function applyBoneTracks(
  vrm: VRM,
  boneTracks: Map<string, BoneTrack>,
  time: number
): void {
  for (const [boneName, track] of boneTracks) {
    // Find the keyframe index for the current time
    let frameIdx = -1;
    for (let i = 0; i < track.times.length - 1; i++) {
      if (time >= track.times[i] && time < track.times[i + 1]) {
        frameIdx = i;
        break;
      }
    }
    if (frameIdx === -1) frameIdx = track.times.length - 1;

    // Extract quaternion (4 floats per frame)
    const vi = frameIdx * 4;
    if (vi + 3 >= track.values.length) continue;

    const x = track.values[vi];
    const y = track.values[vi + 1];
    const z = track.values[vi + 2];
    const w = track.values[vi + 3];

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(w))
      continue;

    // Try normalized bone first, fall back to raw bone
    const boneNameTyped = boneName as VRMHumanBoneName;
    let bone = vrm.humanoid.getNormalizedBoneNode(boneNameTyped);
    if (!bone) {
      bone = vrm.humanoid.getRawBoneNode(boneNameTyped);
    }

    if (bone) {
      // Coordinate conversion: VRMA → Three.js
      bone.quaternion.set(-x, y, -z, w);
    }
  }

  // Transfer normalized bone poses to raw bones for rendering
  vrm.humanoid.update();
}

/**
 * Apply ARKit facial expression data at a given time.
 * Resets all expressions, then applies blendshape weights from the closest frame.
 */
function applyArkitExpressions(
  vrm: VRM,
  arkitData: ArkitData,
  time: number
): void {
  // Find the frame closest to current time
  let frameIdx = 0;
  for (let i = 0; i < arkitData.frames.length; i++) {
    if (arkitData.frames[i].time <= time) {
      frameIdx = i;
    } else {
      break;
    }
  }

  const frame = arkitData.frames[frameIdx];
  if (!frame) return;

  const em = vrm.expressionManager;
  if (!em) return;
  const expressionNames = Object.keys(em.expressionMap);

  // Reset all expressions first
  for (const name of expressionNames) {
    em.setValue(name, 0);
  }

  // Apply ARKit blendshapes
  for (let i = 0; i < arkitData.names.length; i++) {
    if (i < frame.weights.length) {
      const vrmName = arkitToVRMName(arkitData.names[i]);
      if (expressionNames.includes(vrmName)) {
        em.setValue(vrmName, frame.weights[i]);
      }
    }
  }
}

export async function playRound(
  round: number,
  model: Model,
  idleAction: THREE.AnimationAction | null,
  onTextReady: (text: string) => void
): Promise<void> {
  const { vrm } = model;
  if (!vrm) throw new Error("VRM not loaded");

  const cached = cache.get(round);
  if (!cached) throw new Error(`Round ${round} not preloaded`);

  // Display text
  onTextReady(cached.text);

  // Disable auto-blink during playback
  model.emoteController?.setAutoBlink(false);

  // Stop idle animation
  if (idleAction) idleAction.stop();

  // Determine total animation duration
  const duration =
    cached.vrmaDuration > 0
      ? cached.vrmaDuration
      : cached.arkitData.frames[cached.arkitData.frames.length - 1]?.time ?? 5;

  let currentTime = 0;
  let resolved = false;

  // Set up per-frame playback callback (called by Model.update every render frame)
  model.onPlaybackUpdate = (delta: number) => {
    currentTime += delta;
    const t = Math.min(currentTime, duration);

    // VRMA → bone rotations
    applyBoneTracks(vrm, cached.boneTracks, t);
    // ARKit → facial expressions
    applyArkitExpressions(vrm, cached.arkitData, t);
  };

  // Play audio
  const audioCtx = new AudioContext();
  const audioDecoded = await audioCtx.decodeAudioData(cached.audioBuffer.slice(0));
  const source = audioCtx.createBufferSource();
  source.buffer = audioDecoded;
  source.connect(audioCtx.destination);

  return new Promise<void>((resolve) => {
    source.onended = () => {
      if (resolved) return;
      resolved = true;

      // Clean up playback
      model.onPlaybackUpdate = null;

      // Reset VRM pose
      vrm.humanoid.resetNormalizedPose();

      // Restore idle animation
      if (idleAction) idleAction.play();
      model.emoteController?.setAutoBlink(true);
      audioCtx.close();
      resolve();
    };

    source.start(0);
  });
}
