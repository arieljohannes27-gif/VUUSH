import { DocFileField } from "./DocFileField";
import { LiveCamera } from "./LiveCamera";
import { LiveVehicleCamera } from "./LiveVehicleCamera";

export const SIGNUP_STEPS = 6;

export type SignupDraft = {
  displayName: string;
  email: string;
  password: string;
  passwordConfirm: string;
  /** Local digits; UI prefixes +27 */
  phoneLocal: string;
  vehiclePlate: string;
  vehicleClass: "bike" | "car" | "van";
  vehiclePhotoUrl: string | null;
  idDocUrl: string | null;
  licenceDocUrl: string | null;
  selfiePhotoUrl: string | null;
  vehicleInsuranceDocUrl: string | null;
  goodsInsuranceDocUrl: string | null;
  policeClearanceDocUrl: string | null;
};

type Props = {
  step: number;
  draft: SignupDraft;
  busy: boolean;
  onChange: (patch: Partial<SignupDraft>) => void;
  onStep: (step: number) => void;
  onBackToLanding: () => void;
  onSubmit: () => void;
};

const STEP_META: Array<{
  title: string;
  support: string;
  continueLabel: string;
}> = [
  {
    title: "Your details",
    support: "A few facts so we can create your driver account.",
    continueLabel: "Continue",
  },
  {
    title: "ID & licence",
    support: "Clear scans help us verify you faster.",
    continueLabel: "Continue",
  },
  {
    title: "Your photo",
    support: "A live selfie confirms it’s you — not an old gallery shot.",
    continueLabel: "Continue",
  },
  {
    title: "Your vehicle",
    support: "Plate and a live photo of the vehicle you’ll drive.",
    continueLabel: "Continue",
  },
  {
    title: "Insurance",
    support: "Vehicle cover and goods cover (minimum R100 000).",
    continueLabel: "Continue",
  },
  {
    title: "Police clearance",
    support: "Last document, then we’ll confirm your email.",
    continueLabel: "Continue to verify email",
  },
];

function stepComplete(step: number, d: SignupDraft): boolean {
  switch (step) {
    case 1:
      return (
        d.displayName.trim().length > 1 &&
        d.email.trim().includes("@") &&
        d.password.length >= 12 &&
        d.passwordConfirm === d.password
      );
    case 2:
      return Boolean(d.idDocUrl && d.licenceDocUrl);
    case 3:
      return Boolean(d.selfiePhotoUrl);
    case 4:
      return Boolean(d.vehiclePlate.trim() && d.vehiclePhotoUrl);
    case 5:
      return Boolean(d.vehicleInsuranceDocUrl && d.goodsInsuranceDocUrl);
    case 6:
      return Boolean(d.policeClearanceDocUrl);
    default:
      return false;
  }
}

/** Calm multi-step driver registration — same data, less cognitive load. */
export function SignupOnboarding({
  step,
  draft,
  busy,
  onChange,
  onStep,
  onBackToLanding,
  onSubmit,
}: Props) {
  const meta = STEP_META[step - 1] ?? STEP_META[0];
  const progress = (step / SIGNUP_STEPS) * 100;
  const canContinue = stepComplete(step, draft);

  function next() {
    if (step < SIGNUP_STEPS) onStep(step + 1);
    else onSubmit();
  }

  function back() {
    if (step <= 1) onBackToLanding();
    else onStep(step - 1);
  }

  return (
    <div className="onboard">
      <header className="onboard-progress">
        <div className="onboard-progress-meta">
          <span>
            Step {step} of {SIGNUP_STEPS}
          </span>
        </div>
        <div
          className="onboard-progress-track"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={SIGNUP_STEPS}
          aria-label={`Step ${step} of ${SIGNUP_STEPS}`}
        >
          <div className="onboard-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="onboard-hero">
        <h2 className="onboard-title">{meta.title}</h2>
        <p className="onboard-support">{meta.support}</p>
      </div>

      <div className="onboard-body stack">
        {step === 1 && (
          <>
            <label className="field-block">
              <span className="label">Full name</span>
              <input
                className="field"
                value={draft.displayName}
                onChange={(e) => onChange({ displayName: e.target.value })}
                autoComplete="name"
                autoFocus
              />
            </label>
            <label className="field-block">
              <span className="label">Email</span>
              <input
                className="field"
                type="email"
                value={draft.email}
                onChange={(e) => onChange({ email: e.target.value })}
                autoComplete="email"
                inputMode="email"
              />
            </label>
            <label className="field-block">
              <span className="label">Password</span>
              <input
                className="field"
                type="password"
                value={draft.password}
                onChange={(e) => onChange({ password: e.target.value })}
                autoComplete="new-password"
                minLength={8}
              />
              <span className="field-hint">At least 8 characters</span>
            </label>
            <label className="field-block">
              <span className="label">Confirm password</span>
              <input
                className="field"
                type="password"
                value={draft.passwordConfirm}
                onChange={(e) => onChange({ passwordConfirm: e.target.value })}
                autoComplete="new-password"
                minLength={8}
              />
              {draft.passwordConfirm.length > 0 &&
              draft.passwordConfirm !== draft.password ? (
                <span className="field-hint field-hint-warn">
                  Passwords don’t match yet
                </span>
              ) : draft.passwordConfirm.length > 0 &&
                draft.passwordConfirm === draft.password ? (
                <span className="field-hint field-hint-ok">Passwords match</span>
              ) : (
                <span className="field-hint">Re-enter the same password</span>
              )}
            </label>
            <label className="field-block">
              <span className="label">Phone</span>
              <div className="phone-row">
                <span className="phone-prefix" aria-hidden="true">
                  +27
                </span>
                <input
                  className="field phone-local"
                  value={draft.phoneLocal}
                  onChange={(e) =>
                    onChange({
                      phoneLocal: e.target.value.replace(/[^\d\s]/g, ""),
                    })
                  }
                  autoComplete="tel-national"
                  inputMode="tel"
                  placeholder="82 123 4567"
                />
              </div>
              <span className="field-hint">South Africa · optional for now</span>
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <DocFileField
              label="ID document"
              help="South African ID or passport — photo or PDF."
              value={draft.idDocUrl}
              onChange={(v) => onChange({ idDocUrl: v })}
            />
            <DocFileField
              label="Driver licence"
              help="Valid licence — full card, all corners visible."
              value={draft.licenceDocUrl}
              onChange={(v) => onChange({ licenceDocUrl: v })}
            />
            <p className="trust-note">
              Documents are encrypted in transit and used only to verify you as a
              VUUSH driver.
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <LiveCamera
              label="Live selfie"
              help="We’ll match this to your ID. Gallery photos are not accepted."
              guide={[
                "Face the camera in good light",
                "Remove sunglasses and hats",
                "Look straight ahead — one clear shot",
              ]}
              facing="user"
              value={draft.selfiePhotoUrl}
              onCapture={(v) => onChange({ selfiePhotoUrl: v })}
              onClear={() => onChange({ selfiePhotoUrl: null })}
              captureLabel="Capture selfie"
            />
            <p className="trust-note">
              Live capture protects you and customers. This photo stays private to
              verification.
            </p>
          </>
        )}

        {step === 4 && (
          <>
            <label className="field-block">
              <span className="label">Vehicle type</span>
              <select
                className="field"
                value={draft.vehicleClass}
                onChange={(e) =>
                  onChange({
                    vehicleClass: e.target.value as SignupDraft["vehicleClass"],
                  })
                }
              >
                <option value="bike">Bike</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
              </select>
            </label>
            <label className="field-block">
              <span className="label">Number plate</span>
              <input
                className="field field-plate"
                value={draft.vehiclePlate}
                onChange={(e) =>
                  onChange({ vehiclePlate: e.target.value.toUpperCase() })
                }
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="CA 123-456"
              />
            </label>
            <LiveVehicleCamera
              value={draft.vehiclePhotoUrl}
              onCapture={(v) => onChange({ vehiclePhotoUrl: v })}
              onClear={() => onChange({ vehiclePhotoUrl: null })}
            />
          </>
        )}

        {step === 5 && (
          <>
            <DocFileField
              label="Vehicle insurance"
              help="Current policy document for this vehicle."
              value={draft.vehicleInsuranceDocUrl}
              onChange={(v) => onChange({ vehicleInsuranceDocUrl: v })}
            />
            <DocFileField
              label="Goods insurance"
              help="Cargo / goods-in-transit cover of at least R100 000."
              value={draft.goodsInsuranceDocUrl}
              onChange={(v) => onChange({ goodsInsuranceDocUrl: v })}
              hintAfterUpload="Declared cover ≥ R100 000"
            />
            <p className="trust-note">
              We only use these documents to confirm cover before you go on duty.
            </p>
          </>
        )}

        {step === 6 && (
          <>
            <DocFileField
              label="Police clearance"
              help="Valid police clearance certificate — photo or PDF."
              value={draft.policeClearanceDocUrl}
              onChange={(v) => onChange({ policeClearanceDocUrl: v })}
            />
            <div className="review-strip">
              <p className="review-strip-title">Almost done</p>
              <p className="review-strip-body">
                Next we’ll email a short code to confirm {draft.email || "your email"}.
                After that, Admin reviews your application before you go on duty.
              </p>
            </div>
            <p className="trust-note">
              Encrypted upload · used only for driver verification · never sold.
            </p>
          </>
        )}
      </div>

      <footer className="onboard-footer">
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy || !canContinue}
          onClick={next}
        >
          {busy ? "Please wait…" : meta.continueLabel}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={back}>
          {step <= 1 ? "Back to start" : "Back"}
        </button>
      </footer>
    </div>
  );
}

/** Build E.164-ish SA phone from local digits; empty if none. */
export function composeSaPhone(local: string): string | undefined {
  const digits = local.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("27") && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) {
    return `+27${digits.slice(1)}`;
  }
  return `+27${digits}`;
}
