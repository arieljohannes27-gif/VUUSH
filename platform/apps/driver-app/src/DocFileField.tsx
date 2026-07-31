import { useEffect, useState } from "react";

type Props = {
  label: string;
  help: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  /** Shown while we settle after a new upload */
  hintAfterUpload?: string;
};

const MAX = 1_100_000;

type Phase = "idle" | "reading" | "ready";

/** PDF or clear photo — gallery/files allowed (not for selfie/vehicle live shots). */
export function DocFileField({
  label,
  help,
  value,
  onChange,
  hintAfterUpload = "Ready for verification",
}: Props) {
  const inputId = `doc-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const [phase, setPhase] = useState<Phase>(value ? "ready" : "idle");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) setPhase("idle");
  }, [value]);

  async function onFile(file: File | null) {
    setLocalError(null);
    if (!file) {
      onChange(null);
      setPhase("idle");
      return;
    }
    const okType =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!okType) {
      setLocalError("Use a clear photo (JPG/PNG) or a PDF.");
      return;
    }
    setPhase("reading");
    try {
      const dataUrl = await readAsDataUrl(file);
      if (dataUrl.length > MAX) {
        setLocalError(
          "File too large — use a clearer smaller scan (under ~800KB).",
        );
        setPhase("idle");
        onChange(null);
        return;
      }
      onChange(dataUrl);
      // Calm settle — no fake OCR fields; just reassure the file is ready.
      window.setTimeout(() => setPhase("ready"), 480);
    } catch {
      setLocalError("Could not read file");
      setPhase("idle");
      onChange(null);
    }
  }

  const status = !value
    ? "Pending"
    : phase === "reading"
      ? "Reading"
      : "Uploaded";
  const statusTone = !value
    ? "pending"
    : phase === "reading"
      ? "reading"
      : "uploaded";

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

      {localError && <p className="upload-card-error">{localError}</p>}

      {value ? (
        <div className="upload-card-body">
          {value.startsWith("data:image/") ? (
            <img src={value} alt="" className="upload-card-thumb" />
          ) : (
            <div className="upload-card-pdf">PDF attached</div>
          )}
          <p className="upload-card-meta">{hintAfterUpload}</p>
          <div className="upload-card-actions">
            <label className="btn btn-secondary btn-sm" htmlFor={inputId}>
              Replace
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                onChange(null);
                setPhase("idle");
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className="upload-card-drop" htmlFor={inputId}>
          <span className="upload-card-drop-title">Add document</span>
          <span className="upload-card-drop-sub">
            Photo or PDF · clear and readable
          </span>
        </label>
      )}

      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          void onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
