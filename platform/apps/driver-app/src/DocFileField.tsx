type Props = {
  label: string;
  help: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
};

const MAX = 1_100_000;

/** PDF or clear photo — gallery/files allowed (not for selfie/vehicle live shots). */
export function DocFileField({ label, help, value, onChange }: Props) {
  async function onFile(file: File | null) {
    if (!file) {
      onChange(null);
      return;
    }
    const okType =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!okType) {
      throw new Error("Use a clear photo (JPG/PNG) or a PDF.");
    }
    const dataUrl = await readAsDataUrl(file);
    if (dataUrl.length > MAX) {
      throw new Error("File too large — use a clearer smaller scan (under ~800KB).");
    }
    onChange(dataUrl);
  }

  return (
    <div className="stack">
      <p className="label">{label}</p>
      <p className="muted">{help}</p>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="field"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          void onFile(f).catch((err) => {
            alert(err instanceof Error ? err.message : "Could not read file");
            e.target.value = "";
            onChange(null);
          });
        }}
      />
      {value && (
        <p className="muted">
          Attached ({value.startsWith("data:application/pdf") ? "PDF" : "photo"}) ·{" "}
          <button type="button" className="btn" onClick={() => onChange(null)}>
            Remove
          </button>
        </p>
      )}
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
