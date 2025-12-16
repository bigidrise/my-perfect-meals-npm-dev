import { useState, useRef } from "react";

// Detect supported MIME type for MediaRecorder
const getSupportedMimeType = (): { mimeType: string; extension: string } | null => {
  // Check if MediaRecorder exists
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  // Check if isTypeSupported method exists (not available on all browsers)
  if (typeof MediaRecorder.isTypeSupported !== "function") {
    // Some browsers have MediaRecorder but no isTypeSupported
    // Default to audio/webm (most common) and hope for the best
    return { mimeType: "audio/webm", extension: "webm" };
  }

  const types = [
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/mp4", extension: "mp4" },
    { mimeType: "audio/mp4;codecs=mp4a", extension: "mp4" },
    { mimeType: "audio/mpeg", extension: "mp3" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type.mimeType)) {
      return type;
    }
  }

  // No supported MIME type found
  return null;
};

export type RecordingResult = {
  blob: Blob;
  mimeType: string;
  extension: string;
};

export const useMicRecorder = () => {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async (): Promise<RecordingResult> => {
    try {
      // Get supported MIME type for this browser (includes MediaRecorder check)
      const mimeTypeResult = getSupportedMimeType();
      
      if (!mimeTypeResult) {
        throw new Error("Voice recording is not supported on this browser. Please use the text input below.");
      }

      const { mimeType, extension } = mimeTypeResult;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder with detected MIME type
      let mr: MediaRecorder;
      let actualMimeType = mimeType;
      
      try {
        mr = new MediaRecorder(stream, { mimeType });
      } catch (mimeError) {
        // If the detected MIME type fails, try without options
        console.warn(`Failed to create MediaRecorder with ${mimeType}, trying default:`, mimeError);
        mr = new MediaRecorder(stream);
        // Get the actual MIME type the browser chose
        actualMimeType = mr.mimeType || mimeType;
      }
      
      mediaRecorderRef.current = mr;

      // Derive extension from actual MIME type
      let actualExtension = extension;
      if (actualMimeType.includes("webm")) {
        actualExtension = "webm";
      } else if (actualMimeType.includes("mp4") || actualMimeType.includes("m4a")) {
        actualExtension = "mp4";
      } else if (actualMimeType.includes("mpeg") || actualMimeType.includes("mp3")) {
        actualExtension = "mp3";
      } else if (actualMimeType.includes("ogg")) {
        actualExtension = "ogg";
      } else if (actualMimeType.includes("wav")) {
        actualExtension = "wav";
      }

      const chunks: Blob[] = [];

      return new Promise<RecordingResult>((resolve, reject) => {
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mr.onstop = () => {
          const blob = new Blob(chunks, { type: actualMimeType });
          resolve({ blob, mimeType: actualMimeType, extension: actualExtension });
        };

        mr.onerror = (error) => {
          reject(error);
        };

        mr.start();
        setRecording(true);
      });
    } catch (err) {
      setRecording(false);
      throw err;
    }
  };

  const stop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Clean up media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear references
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  return { start, stop, recording };
};
