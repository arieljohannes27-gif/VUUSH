import { useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  help: string;
  /** Short tips shown before camera opens */
  guide?: string[];
  /** user = selfie (front), environment = vehicle (rear) */
  facing: "user" | "environment";
  value: string | null;
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
  captureLabel?: string;
};

/** Live camera only — no gallery / file picker. */
export function LiveCamera({
  label,
  help,
  guide,
  facing,
  value,
  onCapture,
  onClear,
  captureLabel = "Capture now",
}: Props) {
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
          facingMode: { ideal: facing },
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
      setError("Photo too large — try again.");
      return;
    }
    onCapture(dataUrl);
    stopCamera();
  }

  useEffect(() => () => stopCamera(), []);

  const status = value ? "Uploaded" : live ? "Camera ready" : "Pending";
  const statusTone = value ? "uploaded" : live ? "reading" : "pending";

  if (value) {
    return (
      <div className={`upload-card upload-card--${statusTone}`}>
        <div className="upload-card-top">
          <div>
            <p className="upload-card-title">{label}</p>
            <p className="upload-card-help">Taken live with your camera</p>
          </div>
          <span className={`upload-status upload-status--${statusTone}`}>
            {status}
          </span>
        </div>
        <div className="upload-card-body">
          <img src={value} alt={label} className="upload-card-thumb upload-card-thumb--tall" />
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              onClear();
              void startCamera();
            }}
          >
            Retake live photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`upload-card upload-card--${statusTone}`}>
      <div className="upload-card-top">
        <div>
          <p className="upload-card-title">{label}</p>
          <p className="upload-card-help">{help}</p>
        </div>
        <span className={`upload-status upload-status--${statusTone}`}>
          {status}
        </span>
      </div>

      {guide && guide.length > 0 && !live && (
        <ul className="capture-guide">
          {guide.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}

      {error && <p className="upload-card-error">{error}</p>}

      <div className="capture-stage">
        <video
          ref={videoRef}
          playsInline
          muted
          className="capture-video"
          style={{
            display: live ? "block" : "none",
            transform: facing === "user" ? "scaleX(-1)" : undefined,
          }}
        />
        {!live && (
          <p className="capture-stage-idle">Camera off until you are ready</p>
        )}
      </div>

      {!live ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => void startCamera()}
        >
          Open camera
        </button>
      ) : (
        <div className="stack stack-tight">
          <button type="button" className="btn btn-primary btn-block" onClick={snap}>
            {captureLabel}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={stopCamera}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
