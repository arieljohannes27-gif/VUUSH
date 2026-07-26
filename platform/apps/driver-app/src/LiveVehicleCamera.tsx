import { useEffect, useRef, useState } from "react";

type Props = {
  value: string | null;
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
};

/**
 * Live rear-camera capture only — no gallery / file picker.
 * Drivers must photograph the vehicle in the moment.
 */
export function LiveVehicleCamera({ value, onCapture, onClear }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCamera() {
    setError(null);
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported on this device/browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setLive(true);
    } catch (err) {
      setLive(false);
      setError(
        err instanceof Error
          ? err.message
          : "Could not open camera. Allow camera access and try again.",
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }

  function snap() {
    const video = videoRef.current;
    if (!video || !live) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const maxEdge = 960;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Could not capture photo.");
      return;
    }
    ctx.drawImage(video, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > 850_000) {
      setError("Photo too large — stand back and try again.");
      return;
    }
    onCapture(dataUrl);
    stopCamera();
  }

  useEffect(() => () => stopCamera(), []);

  if (value) {
    return (
      <div className="stack">
        <p className="label">Vehicle photo (live)</p>
        <img
          src={value}
          alt="Vehicle captured just now"
          style={{
            width: "100%",
            borderRadius: 8,
            border: "1px solid var(--border, #ddd)",
            maxHeight: 220,
            objectFit: "cover",
          }}
        />
        <p className="muted">Taken live with your camera — not from your gallery.</p>
        <button
          type="button"
          className="btn btn-block"
          onClick={() => {
            onClear();
            void startCamera();
          }}
        >
          Retake live photo
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="label">Vehicle photo — live only</p>
      <p className="muted">
        Open the camera and photograph your vehicle now. Old photos from your gallery are not
        allowed.
      </p>
      {error && <div className="banner banner-error">{error}</div>}
      <div
        style={{
          position: "relative",
          background: "#111",
          borderRadius: 8,
          overflow: "hidden",
          minHeight: 180,
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: "100%",
            display: live ? "block" : "none",
            maxHeight: 240,
            objectFit: "cover",
          }}
        />
        {!live && (
          <p className="muted" style={{ padding: 24, textAlign: "center", color: "#ccc" }}>
            Camera off
          </p>
        )}
      </div>
      {!live ? (
        <button type="button" className="btn btn-primary btn-block" onClick={() => void startCamera()}>
          Open camera
        </button>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-primary btn-block" onClick={snap}>
            Capture vehicle
          </button>
          <button type="button" className="btn btn-block" onClick={stopCamera}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
