import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import {
  STUDIO_VIDEO_CAPTURE_AUDIO_BITS_PER_SECOND,
  STUDIO_VIDEO_CAPTURE_VIDEO_BITS_PER_SECOND,
  STUDIO_VIDEO_MAX_DURATION_SEC,
  STUDIO_VIDEO_MAX_UPLOAD_BYTES,
  STUDIO_VIDEO_RECORDING_ACTIVITY_INTERVAL_MS,
} from "@shared/studioVideoMessages";

export interface StudioVideoMessageComposerProps {
  recipientName: string;
  uploadPath: string;
  onSent: (entry: unknown) => void;
  onCancel: () => void;
}

export function getSupportedVideoMimeType(): string | undefined {
  const types = [
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
    "video/quicktime",
  ];
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return types.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export default function StudioVideoMessageComposer({
  recipientName,
  uploadPath,
  onSent,
  onCancel,
}: StudioVideoMessageComposerProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoMimeType, setVideoMimeType] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendAttemptRef = useRef(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const video = liveVideoRef.current;
    if (!video) return;
    video.srcObject = cameraStream;
    if (cameraStream) {
      try {
        const playResult = video.play();
        playResult?.catch(() => {});
      } catch {
        // Autoplay can be unavailable until the browser grants media permission.
      }
    }
    return () => {
      video.srcObject = null;
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!videoBlob) {
      setPreviewUrl(null);
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(videoBlob);
    setPreviewUrl(nextPreviewUrl);
    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [videoBlob]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStream(null);
  };

  const stopVideoRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  useEffect(() => {
    if (!isRecording) return;
    let disposed = false;

    const refreshRecordingSession = async () => {
      try {
        const response = await fetch(apiUrl("/api/session/activity"), {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ activity: "studio_video_recording" }),
        });

        if (disposed || response.status !== 401) return;

        stopVideoRecording();
        setSendError("Your session expired while recording. Please sign in again before retrying.");
        window.dispatchEvent(new CustomEvent("mpm:session-idle-timeout"));
      } catch {
        // A transient network error should not interrupt a local recording.
        // The next activity interval will retry while recording continues.
      }
    };

    void refreshRecordingSession();
    const activityTimer = setInterval(
      () => void refreshRecordingSession(),
      STUDIO_VIDEO_RECORDING_ACTIVITY_INTERVAL_MS,
    );

    return () => {
      disposed = true;
      clearInterval(activityTimer);
    };
    // stopVideoRecording reads stable refs and is intentionally not a
    // dependency: the interval belongs to the recording session itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const startVideoRecording = async () => {
    setPermissionError(null);
    setSendError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionError("Camera recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: "user",
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
        },
      });
      const preferredMimeType = getSupportedVideoMimeType();
      const recorderOptions = {
        ...(preferredMimeType ? { mimeType: preferredMimeType } : {}),
        videoBitsPerSecond: STUDIO_VIDEO_CAPTURE_VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: STUDIO_VIDEO_CAPTURE_AUDIO_BITS_PER_SECOND,
      };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, recorderOptions);
      } catch {
        // Some browsers reject bitrate options even when they support the
        // selected container. Preserve the MIME fallback in that case.
        recorder = preferredMimeType
          ? new MediaRecorder(stream, { mimeType: preferredMimeType })
          : new MediaRecorder(stream);
      }
      const mimeType = recorder.mimeType || preferredMimeType || "video/webm";
      const chunks: Blob[] = [];

      streamRef.current = stream;
      recorderRef.current = recorder;
      setCameraStream(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        setVideoBlob(new Blob(chunks, { type: mimeType }));
        setVideoMimeType(mimeType);
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) {
          streamRef.current = null;
          setCameraStream(null);
        }
      };

      recorder.start(500);
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => {
           if (seconds >= STUDIO_VIDEO_MAX_DURATION_SEC - 1) {
            if (recorder.state !== "inactive") recorder.stop();
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            setIsRecording(false);
             return STUDIO_VIDEO_MAX_DURATION_SEC;
          }
          return seconds + 1;
        });
      }, 1000);
    } catch {
      setPermissionError(
        "Camera or microphone access was denied. Enable both permissions to record a video message.",
      );
    }
  };

  const discardVideo = () => {
    stopVideoRecording();
    stopStream();
    setVideoBlob(null);
    setVideoMimeType("");
    setRecordingSeconds(0);
    setSendError(null);
  };

  const recordAgain = () => {
    discardVideo();
    void startVideoRecording();
  };

  const handleCancel = () => {
    discardVideo();
    onCancel();
  };

  const sendVideoMessage = async () => {
    if (!videoBlob || sending || sendAttemptRef.current || !uploadPath) {
      if (videoBlob && !uploadPath) {
        setSendError("The recipient connection is still loading. Please try again.");
      }
      return;
    }

    sendAttemptRef.current = true;
    setSending(true);
    setSendError(null);

    try {
      if (videoBlob.size > STUDIO_VIDEO_MAX_UPLOAD_BYTES) {
        throw new Error(
          `This recording is ${formatMiB(videoBlob.size)}. The maximum is 64 MiB. Record a shorter or lower-quality video.`,
        );
      }
      const uploadMimeType = videoMimeType.split(";")[0].trim().toLowerCase() || "video/webm";
      const extension = uploadMimeType === "video/mp4"
        ? "mp4"
        : uploadMimeType === "video/quicktime"
          ? "mov"
          : "webm";
      const uploadBlob = videoBlob.type === uploadMimeType
        ? videoBlob
        : new Blob([videoBlob], { type: uploadMimeType });
      const formData = new FormData();
      formData.append("video", uploadBlob, `studio-video-message.${extension}`);
      formData.append("durationSec", String(Math.max(1, recordingSeconds)));

      const response = await fetch(apiUrl(uploadPath), {
        method: "POST",
        headers: { ...getAuthHeaders() },
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send video message");
      }

      const data = await response.json();
      setVideoBlob(null);
      setVideoMimeType("");
      setRecordingSeconds(0);
      onSent(data.entry);
      onCancel();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to send video message");
      sendAttemptRef.current = false;
    } finally {
      setSending(false);
    }
  };

  const hasCamera = !!cameraStream?.getVideoTracks().length;
  const hasMicrophone = !!cameraStream?.getAudioTracks().length;

  return (
    <div
      className="rounded-lg border border-violet-500/30 bg-violet-500/8 p-3 space-y-3"
      data-testid="studio-video-composer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-violet-100 font-semibold">Video message to {recipientName}</p>
          <p className="text-[10px] text-white/50 leading-snug mt-0.5">
            Only you and this recipient can view this message.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="shrink-0 rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"
          aria-label="Cancel video message"
          data-testid="cancel-video-message"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {(permissionError || sendError) && (
        <div
          className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10px] text-red-300"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{permissionError || sendError}</span>
        </div>
      )}

      <div className="relative aspect-video overflow-hidden rounded-md bg-black/50 border border-white/10">
        <video
          ref={liveVideoRef}
          autoPlay
          muted
          playsInline
          className={`h-full w-full object-cover ${videoBlob ? "hidden" : ""}`}
          aria-label="Live camera preview"
          data-testid="live-video-preview"
        />
        {videoBlob && previewUrl && (
          <video
            src={previewUrl}
            controls
            playsInline
            className="h-full w-full object-contain bg-black"
            aria-label="Recorded video preview"
            data-testid="recorded-video-preview"
          />
        )}
        {!videoBlob && !cameraStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40">
            <Video className="h-7 w-7" />
            <span className="text-[10px]">Camera preview appears when recording starts</span>
          </div>
        )}
        {isRecording && (
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-1 text-[10px] text-red-300 font-mono">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
           REC {formatDuration(recordingSeconds)} / 5:00
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/45">
        <span className={`inline-flex items-center gap-1 ${hasCamera ? "text-emerald-300" : ""}`}>
          <Camera className="h-3 w-3" />
          {hasCamera ? "Camera ready" : "Camera needed"}
        </span>
        <span className={`inline-flex items-center gap-1 ${hasMicrophone ? "text-emerald-300" : ""}`}>
          <Mic className="h-3 w-3" />
          {hasMicrophone ? "Microphone ready" : "Microphone needed"}
        </span>
        {videoBlob && !isRecording && (
          <span className="ml-auto text-violet-200 font-mono">
            {formatDuration(recordingSeconds)}
          </span>
        )}
      </div>

      {!videoBlob ? (
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <span className="flex items-center gap-1.5 text-[10px] text-red-300 font-mono">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Recording
              </span>
              <button
                type="button"
                onClick={stopVideoRecording}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-500"
                data-testid="stop-video-recording"
              >
                <Square className="h-3 w-3" />
                Stop
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void startVideoRecording()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
              data-testid="start-video-recording"
            >
              <Video className="h-3.5 w-3.5" />
              Record video
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-violet-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Review the complete recording before sending. Nothing has been uploaded.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={recordAgain}
              disabled={sending}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/15 disabled:opacity-50"
              data-testid="record-video-again"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Record Again
            </button>
            <button
              type="button"
              onClick={discardVideo}
              disabled={sending}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/15 disabled:opacity-50"
              data-testid="discard-video"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Discard
            </button>
          </div>
          <button
            type="button"
            onClick={() => void sendVideoMessage()}
            disabled={sending}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
            data-testid="send-video-message"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? "Sending…" : sendError ? `Retry send to ${recipientName}` : `Send to ${recipientName}`}
          </button>
          {sendError && (
            <p className="text-center text-[10px] text-red-300">
              Your recording is still here. Fix the issue and retry.
            </p>
          )}
        </div>
      )}

      {!videoBlob && !isRecording && (
        <p className="text-center text-[10px] text-white/35">
           Maximum 5 minutes. Recordings over 64 MiB cannot be sent.
        </p>
      )}
      {videoBlob && !sending && (
        <button
          type="button"
          onClick={handleCancel}
          className="flex w-full items-center justify-center gap-1 text-[10px] text-white/35 hover:text-white/60"
          data-testid="cancel-video-composer"
        >
          <Trash2 className="h-3 w-3" />
          Cancel and discard recording
        </button>
      )}
      {videoBlob && sending && (
        <p className="flex items-center justify-center gap-1 text-[10px] text-white/35">
          <Play className="h-3 w-3" />
          Uploading securely — keep this window open
        </p>
      )}
    </div>
  );
}