import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Pressable, Text, View } from "react-native";
import {
  getAudioDurationLimitMs,
  startAudioRecording,
  stopAudioRecording,
  validateVoiceDuration
} from "../services/voice";

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const sec = String(totalSec % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

export default function AudioRecorder({ visible, onCancel, onComplete, onError }) {
  const [recording, setRecording] = useState(null);
  const [durationMs, setDurationMs] = useState(0);
  const [bars, setBars] = useState(Array.from({ length: 24 }, () => 8));
  const [starting, setStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const blink = useRef(new Animated.Value(1)).current;
  const limitMs = getAudioDurationLimitMs();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.35, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true })
      ])
    );
    if (visible && recording) {
      loop.start();
    }
    return () => loop.stop();
  }, [visible, recording, blink]);

  useEffect(() => {
    let interval = null;
    if (visible && recording) {
      interval = setInterval(async () => {
        const status = await recording.getStatusAsync();
        if (!status?.isRecording) {
          return;
        }

        const nextDuration = Number(status.durationMillis || 0);
        setDurationMs(nextDuration);

        const metering = Number(status.metering || -140);
        const scaled = Math.max(4, Math.min(30, Math.round((metering + 160) / 5)));
        setBars((prev) => [...prev.slice(1), scaled]);

        if (nextDuration >= limitMs) {
          await stop();
        }
      }, 250);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [visible, recording]);

  const warningText = useMemo(() => {
    if (!recording) {
      return "";
    }
    if (durationMs >= limitMs - 30000) {
      return "Approaching 5-minute limit";
    }
    return "";
  }, [durationMs, limitMs, recording]);

  const reset = () => {
    setRecording(null);
    setDurationMs(0);
    setBars(Array.from({ length: 24 }, () => 8));
    setStarting(false);
    setProcessing(false);
  };

  const start = async () => {
    if (starting || recording) {
      return;
    }

    setStarting(true);
    try {
      const nextRecording = await startAudioRecording();
      setRecording(nextRecording);
    } catch (error) {
      onError?.(error);
      reset();
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    if (!recording || processing) {
      return;
    }

    setProcessing(true);
    try {
      const result = await stopAudioRecording(recording);
      validateVoiceDuration(result.durationMillis);
      onComplete?.(result);
      reset();
    } catch (error) {
      onError?.(error);
      setProcessing(false);
      setRecording(null);
    }
  };

  const cancel = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
      }
    } catch (error) {
      // Ignore stop failures while cancelling.
    }
    reset();
    onCancel?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}
      >
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 14, width: "100%", padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "800" }}>Record Issue (Audio)</Text>
          <Text style={{ marginTop: 4, color: "#59636E" }}>Speak clearly. Max duration is 5 minutes.</Text>

          <View style={{ marginTop: 14, alignItems: "center" }}>
            <Animated.Text style={{ color: "#D1242F", fontWeight: "700", opacity: blink }}>
              {recording ? "Recording..." : "Ready to record"}
            </Animated.Text>
            <Text style={{ fontSize: 28, fontWeight: "800", marginTop: 4 }}>{formatMs(durationMs)}</Text>
            {warningText ? <Text style={{ color: "#8A4B00", marginTop: 2 }}>{warningText}</Text> : null}
          </View>

          <View style={{ flexDirection: "row", gap: 3, marginTop: 16, alignSelf: "center", height: 34 }}>
            {bars.map((value, index) => (
              <View
                key={`bar-${index}`}
                style={{
                  width: 4,
                  height: value,
                  borderRadius: 2,
                  alignSelf: "flex-end",
                  backgroundColor: recording ? "#0969DA" : "#D0D7DE"
                }}
              />
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
            <Pressable
              onPress={cancel}
              style={{ flex: 1, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 12 }}
            >
              <Text style={{ textAlign: "center", fontWeight: "700" }}>Cancel</Text>
            </Pressable>

            {!recording ? (
              <Pressable
                onPress={start}
                style={{ flex: 1, backgroundColor: "#0969DA", borderRadius: 8, padding: 12, opacity: starting ? 0.7 : 1 }}
                disabled={starting}
              >
                <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700" }}>
                  {starting ? "Starting..." : "Start"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={stop}
                style={{ flex: 1, backgroundColor: "#D1242F", borderRadius: 8, padding: 12, opacity: processing ? 0.7 : 1 }}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700" }}>Stop</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}