import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROOF_ROOT = path.join(__dirname, "../../../.data/proofs");

/**
 * Local private object store for Wave 1.
 * Never expose this folder publicly; return opaque object keys only.
 */
export async function storeProofObject(input: {
  jobId: string;
  kind: string;
  contentBase64?: string;
  textContent?: string;
  contentType?: string;
}): Promise<{ objectKey: string; contentType: string }> {
  await mkdir(PROOF_ROOT, { recursive: true });
  const id = randomUUID();
  const objectKey = `proofs/${input.jobId}/${input.kind}/${id}`;
  const abs = path.join(PROOF_ROOT, input.jobId, input.kind);
  await mkdir(abs, { recursive: true });

  let bytes: Buffer;
  let contentType = input.contentType ?? "application/octet-stream";
  if (input.textContent != null) {
    bytes = Buffer.from(input.textContent, "utf8");
    contentType = input.contentType ?? "text/plain";
  } else if (input.contentBase64) {
    const raw = input.contentBase64.includes(",")
      ? input.contentBase64.split(",")[1]!
      : input.contentBase64;
    bytes = Buffer.from(raw, "base64");
    contentType = input.contentType ?? "image/jpeg";
  } else {
    bytes = Buffer.from(
      JSON.stringify({
        placeholder: true,
        kind: input.kind,
        sha: createHash("sha256").update(objectKey).digest("hex").slice(0, 16),
      }),
    );
    contentType = "application/json";
  }

  await writeFile(path.join(abs, id), bytes);
  return { objectKey, contentType };
}
