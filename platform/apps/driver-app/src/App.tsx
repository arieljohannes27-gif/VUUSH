import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  openNavPlaceholder,
  navigatePlaceholder,
  systemNavUrl,
  navTargetForJob,
  SwiftMap,
  type MapLine,
  type MapMarker,
  type NavTarget,
} from "./maps";
import {
  acceptAssignment,
  addProof,
  declareEmergency,
  ensureDriver,
  execStep,
  fetchActiveIncident,
  fetchDriverHome,
  fetchDriverJobHistory,
  fetchDriverProfile,
  fetchEarnings,
  fetchJobProofs,
  fetchMe,
  loginPassword,
  pingSignal,
  readGps,
  rejectAssignment,
  requestOtp,
  setDuty,
  signupDriver,
  startTracking,
  updateDriverProfile,
  verifyDriverSignup,
  type Assignment,
  type DriverProfessional,
  type DriverProfile,
  type EarningLine,
  type Job,
  type SessionUser,
  verifyOtp,
} from "./api";
import { startOfferAlert, stopOfferAlert, unlockOfferAudio, OFFER_ALERT_MS } from "./offerSound";
import {
  composeSaPhone,
  SignupOnboarding,
  type SignupDraft,
} from "./SignupOnboarding";

type Tab = "home" | "job" | "earnings" | "emergency" | "settings";
type AuthView = "landing" | "signup" | "signin" | "verify";

const TOKEN_KEY = "vuush.driver.token";
const TOKEN_KEY_LEGACY = "swift.driver.token";

function readStoredToken() {
  return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY_LEGACY);
}
function writeStoredToken(value: string) {
  localStorage.setItem(TOKEN_KEY, value);
  localStorage.removeItem(TOKEN_KEY_LEGACY);
}
function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY_LEGACY);
}

function BrandLockup({ compact }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}>
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-wordmark">VUUSH</span>
    </span>
  );
}

/** Beachhead: resize + JPEG data-URL for driver profile photo (no object storage yet). */
async function imageFileToPhotoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  const bitmap = await createImageBitmap(file);
  const maxEdge = 512;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  if (dataUrl.length > 550_000) {
    throw new Error("Photo is still too large — try a smaller image.");
  }
  return dataUrl;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function nextAction(state: string): { label: string; step: string } | null {
  switch (state) {
    case "ASSIGNED":
      return { label: "Head to pickup", step: "en-route-pickup" };
    case "EN_ROUTE_PICKUP":
      return { label: "I’ve arrived at pickup", step: "arrive-pickup" };
    case "ARRIVED_PICKUP":
      return { label: "Confirm pickup", step: "pickup" };
    case "PICKED_UP":
    case "IN_TRANSIT":
      return { label: "I’ve arrived at dropoff", step: "arrive-dropoff" };
    case "ARRIVED_DROPOFF":
      return { label: "Complete delivery", step: "deliver" };
    default:
      return null;
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [earnings, setEarnings] = useState<EarningLine[]>([]);
  const [tripHistory, setTripHistory] = useState<{
    job: Job & { state: string; publicCode: string };
    earning: EarningLine | null;
    proofs: Array<{ id: string; kind: string; note: string | null; createdAt: string }>;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [authView, setAuthView] = useState<AuthView>("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleClass, setVehicleClass] = useState<"bike" | "car" | "van">("car");
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState<string | null>(null);
  const [idDocUrl, setIdDocUrl] = useState<string | null>(null);
  const [licenceDocUrl, setLicenceDocUrl] = useState<string | null>(null);
  const [selfiePhotoUrl, setSelfiePhotoUrl] = useState<string | null>(null);
  const [vehicleInsuranceDocUrl, setVehicleInsuranceDocUrl] = useState<string | null>(null);
  const [goodsInsuranceDocUrl, setGoodsInsuranceDocUrl] = useState<string | null>(null);
  const [policeClearanceDocUrl, setPoliceClearanceDocUrl] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [signupMode, setSignupMode] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [proofNote, setProofNote] = useState("");
  const [failReason, setFailReason] = useState("customer_unavailable");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeIncident, setActiveIncident] = useState<{
    id: string;
    publicCode: string;
    category: string;
    status: string;
    playbook: string;
  } | null>(null);
  const trackingRef = useRef<number | null>(null);
  const lastOfferIdRef = useRef<string | null>(null);
  const offerArmedRef = useRef(false);
  const offerRingingRef = useRef(false);
  const offerTimeoutBusyRef = useRef(false);
  const [offerProgress, setOfferProgress] = useState(0); // 0 → 1 fills Accept ring
  const [navBlocked, setNavBlocked] = useState<NavTarget | null>(null);
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null);
  const autoNavKeyRef = useRef<string | null>(null);
  const prevAssignmentRef = useRef<{ id: string; status: string } | null>(null);
  const [profBundle, setProfBundle] = useState<{
    profile: DriverProfile;
    user: {
      id: string;
      email: string | null;
      phone: string | null;
      displayName: string | null;
    };
    professional: DriverProfessional;
  } | null>(null);
  const [profDraft, setProfDraft] = useState({
    publicName: "",
    photoUrl: "",
    phonePublic: "",
    vehiclePlate: "",
    vehicleLabel: "",
    bio: "",
    vehicleClass: "van",
    homeZoneCode: "",
  });

  const loadProfileSettings = useEffectEvent(async () => {
    if (!token) return;
    try {
      const res = await fetchDriverProfile(token);
      setProfBundle(res);
      setProfDraft({
        publicName: res.profile.publicName ?? res.professional.publicName ?? "",
        photoUrl: res.profile.photoUrl ?? "",
        phonePublic: res.profile.phonePublic ?? res.user.phone ?? "",
        vehiclePlate: res.profile.vehiclePlate ?? "",
        vehicleLabel: res.profile.vehicleLabel ?? "",
        bio: res.profile.bio ?? "",
        vehicleClass: res.profile.vehicleClass ?? "van",
        homeZoneCode: res.profile.homeZoneCode ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "profile_load_failed");
    }
  });

  const saveProfileSettings = useEffectEvent(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await updateDriverProfile(token, {
        publicName: profDraft.publicName.trim() || null,
        photoUrl: profDraft.photoUrl.trim() || null,
        phonePublic: profDraft.phonePublic.trim() || null,
        vehiclePlate: profDraft.vehiclePlate.trim() || null,
        vehicleLabel: profDraft.vehicleLabel.trim() || null,
        bio: profDraft.bio.trim() || null,
        vehicleClass: profDraft.vehicleClass,
        homeZoneCode: profDraft.homeZoneCode.trim() || null,
        displayName: profDraft.publicName.trim() || null,
      });
      setProfBundle(res);
      setNotice("Profile saved — customers see this on live jobs.");
      void refresh(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "profile_save_failed");
    } finally {
      setBusy(false);
    }
  });

  const tryAutoNav = (target: NavTarget, key: string, preOpened?: Window | null) => {
    autoNavKeyRef.current = key;
    navigatePlaceholder(preOpened, target);
    // Web popup blockers are unreliable — always offer one-tap recover.
    setNavBlocked(target);
  };

  const refresh = useEffectEvent(async (accessToken: string) => {
    const home = await fetchDriverHome(accessToken);
    setNavTarget(home.navTarget);
    // Beep on any NEW assignment (offer or direct assign)
    const nextId = home.assignment?.id ?? null;

    if (
      offerArmedRef.current &&
      nextId &&
      nextId !== lastOfferIdRef.current
    ) {
      await unlockOfferAudio();
      if (home.assignment?.status === "offered") {
        offerRingingRef.current = true;
        void startOfferAlert();
        setNotice("New job offer — ringing until you Accept or Decline.");
        setTab("home");
      } else if (home.assignment?.status === "active") {
        offerRingingRef.current = false;
        stopOfferAlert();
        void startOfferAlert(3500);
        setNotice("New job assigned — open Job when ready.");
        // Stay on Home so duty / idle isn’t yanked; user taps Open job.
      }
    } else if (
      offerRingingRef.current &&
      (!home.assignment || home.assignment.status !== "offered")
    ) {
      offerRingingRef.current = false;
      stopOfferAlert();
    }
    lastOfferIdRef.current = nextId;

    setProfile(home.profile);
    setAssignment(home.assignment);
    setJob(home.job);

    // Only jump to Job when an assignment *newly becomes* active (e.g. you just accepted).
    // Do NOT yank Home → Job every poll while an old active job exists.
    const prev = prevAssignmentRef.current;
    const cur = home.assignment;
    const becameActive =
      Boolean(home.job) &&
      cur?.status === "active" &&
      (!prev || prev.id !== cur.id || prev.status !== "active");
    if (becameActive) {
      setTab("job");
    }
    prevAssignmentRef.current = cur
      ? { id: cur.id, status: cur.status }
      : null;

    try {
      const active = await fetchActiveIncident(accessToken);
      setActiveIncident(active.incident);
    } catch {
      /* ignore */
    }
  });

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const me = await fetchMe(token);
        if (cancelled) return;
        setUser(me.user);
        let home = await fetchDriverHome(token);
        if (!home.profile) {
          await ensureDriver(me.user.id);
          home = await fetchDriverHome(token);
        }
        if (cancelled) return;
        setProfile(home.profile);
        setAssignment(home.assignment);
        setJob(home.job);
        prevAssignmentRef.current = home.assignment
          ? { id: home.assignment.id, status: home.assignment.status }
          : null;
        // Don't seed lastOfferId yet if an offer is waiting — beep below, then arm.
        const waitingOffer =
          home.assignment?.status === "offered" ? home.assignment.id : null;
        lastOfferIdRef.current = waitingOffer
          ? null
          : (home.assignment?.id ?? null);
        offerArmedRef.current = true;
        await unlockOfferAudio();
        if (waitingOffer) {
          lastOfferIdRef.current = waitingOffer;
          offerRingingRef.current = true;
          void startOfferAlert();
          setNotice("New job offer — ringing until you Accept or Decline.");
          setTab("home");
        }
      } catch (err) {
        if (cancelled) return;
        clearStoredToken();
        setToken(null);
        setError(err instanceof Error ? err.message : "session_expired");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      void refresh(token).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (!token || !job || assignment?.status !== "active") {
      if (trackingRef.current) {
        window.clearInterval(trackingRef.current);
        trackingRef.current = null;
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const started = await startTracking(token, job.id);
        if (cancelled) return;
        setSessionId(started.session.id);
        trackingRef.current = window.setInterval(async () => {
          try {
            const gps = await readGps();
            await pingSignal(token, started.session.id, gps.lat, gps.lng);
          } catch {
            /* keep UI calm; offline banner covers connectivity */
          }
        }, 15000);
      } catch {
        /* session may already exist or job not yet trackable */
      }
    })();
    return () => {
      cancelled = true;
      if (trackingRef.current) {
        window.clearInterval(trackingRef.current);
        trackingRef.current = null;
      }
    };
  }, [token, job?.id, assignment?.status]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "request_failed";
      const human =
        raw === "pickup_note_required"
          ? "Add a short pickup proof note first."
          : raw === "delivery_note_required"
            ? "Add a delivery / signature note first."
            : raw === "otp_delivery_failed" || raw === "otp_email_not_configured"
              ? "We couldn’t email your code. Use the same Gmail as your Resend account, or sign in with password if you already submitted."
              : raw === "login_incomplete"
                ? "Sign-in almost finished — tap Confirm again after the next update, or sign in with your password."
              : raw === "email_taken"
                ? "That email already has an account. Sign in instead."
                : raw === "Failed to fetch" || raw.startsWith("request_failed_")
                  ? "Upload failed — try smaller/clearer photos (not huge PDFs), then tap Continue again."
                  : raw;
      setError(human);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup() {
    await run(async () => {
      if (!idDocUrl) throw new Error("Upload your ID (PDF or clear photo).");
      if (!licenceDocUrl) throw new Error("Upload your driver licence (PDF or clear photo).");
      if (!selfiePhotoUrl) throw new Error("Take a live selfie first.");
      if (!vehiclePhotoUrl) throw new Error("Take a live photo of your vehicle first.");
      if (!vehicleInsuranceDocUrl) {
        throw new Error("Upload vehicle insurance document.");
      }
      if (!goodsInsuranceDocUrl) {
        throw new Error("Upload goods insurance cover (min R100 000).");
      }
      if (!policeClearanceDocUrl) {
        throw new Error("Upload police clearance (PDF or clear photo).");
      }
      const res = await signupDriver({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        phone: composeSaPhone(phone),
        vehiclePlate: vehiclePlate.trim() || undefined,
        vehicleClass,
        vehiclePhotoUrl,
        idDocUrl,
        licenceDocUrl,
        selfiePhotoUrl,
        vehicleInsuranceDocUrl,
        goodsInsuranceDocUrl,
        policeClearanceDocUrl,
        applicationNote: "Goods cover declared ≥ R100 000",
      });
      setChallengeId(res.challengeId);
      setDevCode(res.devCode ?? null);
      if (res.devCode) setOtp(res.devCode);
      setSignupMode(true);
      setAuthView("verify");
      setNotice("We sent a code to confirm your email.");
    });
  }

  async function handlePasswordLogin() {
    await run(async () => {
      await unlockOfferAudio();
      const res = await loginPassword(email.trim(), password);
      writeStoredToken(res.session.accessToken);
      setToken(res.session.accessToken);
      setUser(res.user);
      if (res.profile) setProfile(res.profile);
      await refresh(res.session.accessToken);
      offerArmedRef.current = true;
      setNotice("You’re signed in.");
    });
  }

  async function handleRequestOtp() {
    await run(async () => {
      const res = await requestOtp(email.trim());
      setChallengeId(res.challengeId);
      setDevCode(res.devCode ?? null);
      if (res.devCode) setOtp(res.devCode);
      setSignupMode(false);
      setAuthView("verify");
    });
  }

  async function handleVerifyOtp() {
    if (!challengeId) return;
    await run(async () => {
      await unlockOfferAudio();
      if (signupMode) {
        const res = await verifyDriverSignup(challengeId, otp.trim());
        if (!res.session?.accessToken || !res.user) {
          throw new Error("login_incomplete");
        }
        writeStoredToken(res.session.accessToken);
        setToken(res.session.accessToken);
        setUser(res.user);
        if (res.profile) setProfile(res.profile);
        await refresh(res.session.accessToken);
        setNotice("Application received — waiting for approval.");
        return;
      }
      const res = await verifyOtp(challengeId, otp.trim());
      if (!res.session?.accessToken || !res.user) {
        throw new Error("login_incomplete");
      }
      writeStoredToken(res.session.accessToken);
      setToken(res.session.accessToken);
      setUser(res.user);
      try {
        await ensureDriver(res.user.id);
      } catch {
        /* new applicants use password signup */
      }
      await refresh(res.session.accessToken);
      offerArmedRef.current = true;
      setNotice("You’re signed in.");
    });
  }

  async function toggleDuty() {
    if (!token || !profile) return;
    await run(async () => {
      await unlockOfferAudio();
      const res = await setDuty(token, !profile.onDuty);
      setProfile(res.profile);
      setNotice(res.profile.onDuty ? "You’re on duty." : "You’re off duty.");
      await refresh(token);
    });
  }

  async function handleAccept() {
    if (!token || !assignment || !job) return;
    offerRingingRef.current = false;
    stopOfferAlert();
    setOfferProgress(0);
    const target = navTargetForJob({ ...job, state: "ASSIGNED" });
    const pre = openNavPlaceholder();
    await run(async () => {
      await acceptAssignment(token, assignment.id);
      await refresh(token);
      setTab("job");
      setNotice("Job accepted.");
      tryAutoNav(target, `accept:${assignment.id}:pickup`, pre);
    });
  }

  const expireOffer = useEffectEvent(async () => {
    if (!token || !assignment || assignment.status !== "offered") return;
    if (offerTimeoutBusyRef.current || busy) return;
    offerTimeoutBusyRef.current = true;
    offerRingingRef.current = false;
    stopOfferAlert();
    setOfferProgress(1);
    try {
      await rejectAssignment(token, assignment.id, "offer_timeout");
      await refresh(token);
      setNotice("Offer timed out — waiting for dispatch to resend.");
    } catch {
      offerTimeoutBusyRef.current = false;
    } finally {
      setOfferProgress(0);
    }
  });

  async function handleReject(reasonCode = "driver_declined") {
    if (!token || !assignment) return;
    offerRingingRef.current = false;
    stopOfferAlert();
    setOfferProgress(0);
    await run(async () => {
      await rejectAssignment(token, assignment.id, reasonCode);
      await refresh(token);
      setNotice(
        reasonCode === "offer_timeout"
          ? "Offer timed out — waiting for dispatch to resend."
          : "Offer declined.",
      );
    });
  }

  // Bolt-style: Accept ring fills grey → blue; when full, auto-decline.
  useEffect(() => {
    if (assignment?.status !== "offered" || !assignment.id) {
      setOfferProgress(0);
      offerTimeoutBusyRef.current = false;
      return;
    }
    const started = Date.now();
    let raf = 0;
    let cancelled = false;
    offerTimeoutBusyRef.current = false;

    const tick = () => {
      if (cancelled) return;
      const p = Math.min(1, (Date.now() - started) / OFFER_ALERT_MS);
      setOfferProgress(p);
      if (p >= 1) {
        void expireOffer();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [assignment?.id, assignment?.status]);

  async function handleStep(step: string) {
    if (!token || !job) return;
    await run(async () => {
      if (step === "pickup") {
        if (!proofNote.trim()) throw new Error("pickup_note_required");
        await addProof(token, job.id, "pickup_photo", proofNote.trim());
        setProofNote("");
      }
      if (step === "deliver") {
        if (!proofNote.trim()) throw new Error("delivery_note_required");
        const gps = await readGps().catch(() =>
          job.dropoffLat != null && job.dropoffLng != null
            ? { lat: job.dropoffLat, lng: job.dropoffLng }
            : Promise.reject(new Error("gps_required")),
        );
        await addProof(token, job.id, "dropoff_signature", proofNote.trim(), gps);
        const res = await execStep(token, job.id, "deliver", gps);
        setJob(res.job);
        setProofNote("");
        setNotice("Delivery complete.");
        await refresh(token);
        return;
      }
      const pre =
        step === "pickup" ? openNavPlaceholder() : null;
      const res = await execStep(token, job.id, step);
      setJob(res.job);
      setNotice(`Updated: ${res.job.state}`);
      await refresh(token);
      if (step === "pickup") {
        const target = navTargetForJob({ ...res.job, state: "PICKED_UP" });
        tryAutoNav(target, `pickup:${job.id}:dropoff`, pre);
      } else if (pre) {
        pre.close();
      }
    });
  }

  async function handleFail() {
    if (!token || !job) return;
    await run(async () => {
      await execStep(token, job.id, "fail-attempt", { reasonCode: failReason });
      await refresh(token);
      setNotice("Failed attempt recorded.");
    });
  }

  async function loadEarnings(quiet = false) {
    if (!token) return;
    const pull = async () => {
      const res = await fetchEarnings(token);
      setEarnings(res.earnings);
    };
    if (quiet) {
      try {
        await pull();
      } catch {
        /* ignore background refresh */
      }
      return;
    }
    await run(pull);
  }

  async function openTripHistory(jobId: string) {
    if (!token) return;
    await run(async () => {
      const [history, proofs] = await Promise.all([
        fetchDriverJobHistory(token, jobId),
        fetchJobProofs(token, jobId),
      ]);
      setTripHistory({
        job: history.job,
        earning: history.earning,
        proofs: proofs.proofs,
      });
    });
  }

  async function handleEmergency(
    category: "medical" | "threat" | "accident" | "assault",
  ) {
    if (!token) return;
    await run(async () => {
      const gps = await readGps().catch(() => undefined);
      const res = await declareEmergency(token, category, undefined, gps);
      setActiveIncident(res.incident);
      setNotice(
        category === "threat"
          ? "Call local emergency services first if needed. Help path started — job paused."
          : "Help path started. Stay safe — this is not a punish path.",
      );
      await refresh(token);
      setTab("emergency");
    });
  }

  function signOut() {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setProfile(null);
    setAssignment(null);
    setJob(null);
    setSessionId(null);
  }

  if (!token || !user) {
    return (
      <div className="app">
        {!online && (
          <div className="banner banner-offline">You’re offline. Sign-in needs a connection.</div>
        )}
        {error && <div className="banner banner-error">{error}</div>}
        {notice && <div className="banner banner-ok">{notice}</div>}
        <div className="app-shell stack">
          <div>
            <h1 className="login-brand">
              <BrandLockup />
            </h1>
            {authView === "landing" ? (
              <p className="login-title">Driver</p>
            ) : null}
          </div>

          {authView === "landing" && (
            <div className="onboard-landing">
              <p className="onboard-title">Earn on your terms.</p>
              <p className="onboard-support">
                Flexible city runs, clear pay, and a team that has your back.
              </p>
              <div className="onboard-footer">
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    setAuthView("signup");
                    setSignupStep(1);
                    setError(null);
                  }}
                >
                  Become a driver
                </button>
                <button
                  className="btn btn-ghost btn-block"
                  onClick={() => {
                    setAuthView("signin");
                    setError(null);
                  }}
                >
                  I already have an account
                </button>
              </div>
            </div>
          )}

          {authView === "signup" && (
            <SignupOnboarding
              step={signupStep}
              busy={busy}
              draft={{
                displayName,
                email,
                password,
                phoneLocal: phone,
                vehiclePlate,
                vehicleClass,
                vehiclePhotoUrl,
                idDocUrl,
                licenceDocUrl,
                selfiePhotoUrl,
                vehicleInsuranceDocUrl,
                goodsInsuranceDocUrl,
                policeClearanceDocUrl,
              }}
              onChange={(patch: Partial<SignupDraft>) => {
                if (patch.displayName !== undefined) setDisplayName(patch.displayName);
                if (patch.email !== undefined) setEmail(patch.email);
                if (patch.password !== undefined) setPassword(patch.password);
                if (patch.phoneLocal !== undefined) setPhone(patch.phoneLocal);
                if (patch.vehiclePlate !== undefined) setVehiclePlate(patch.vehiclePlate);
                if (patch.vehicleClass !== undefined) setVehicleClass(patch.vehicleClass);
                if (patch.vehiclePhotoUrl !== undefined) setVehiclePhotoUrl(patch.vehiclePhotoUrl);
                if (patch.idDocUrl !== undefined) setIdDocUrl(patch.idDocUrl);
                if (patch.licenceDocUrl !== undefined) setLicenceDocUrl(patch.licenceDocUrl);
                if (patch.selfiePhotoUrl !== undefined) setSelfiePhotoUrl(patch.selfiePhotoUrl);
                if (patch.vehicleInsuranceDocUrl !== undefined) {
                  setVehicleInsuranceDocUrl(patch.vehicleInsuranceDocUrl);
                }
                if (patch.goodsInsuranceDocUrl !== undefined) {
                  setGoodsInsuranceDocUrl(patch.goodsInsuranceDocUrl);
                }
                if (patch.policeClearanceDocUrl !== undefined) {
                  setPoliceClearanceDocUrl(patch.policeClearanceDocUrl);
                }
              }}
              onStep={setSignupStep}
              onBackToLanding={() => {
                setAuthView("landing");
                setError(null);
              }}
              onSubmit={() => void handleSignup()}
            />
          )}

          {authView === "signin" && (
            <div className="onboard">
              <div className="onboard-hero">
                <h2 className="onboard-title">Welcome back</h2>
                <p className="onboard-support">Sign in to continue driving with VUUSH.</p>
              </div>
              <div className="onboard-body stack">
                <label className="field-block">
                  <span className="label">Email</span>
                  <input
                    id="email2"
                    className="field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label className="field-block">
                  <span className="label">Password</span>
                  <input
                    id="password2"
                    type="password"
                    className="field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>
              </div>
              <footer className="onboard-footer">
                <button
                  className="btn btn-primary btn-block"
                  disabled={busy}
                  onClick={handlePasswordLogin}
                >
                  Sign in
                </button>
                <button
                  className="btn btn-ghost btn-block"
                  type="button"
                  disabled={busy}
                  onClick={handleRequestOtp}
                >
                  Use email code instead
                </button>
                <button
                  className="btn btn-ghost btn-block"
                  type="button"
                  onClick={() => setAuthView("landing")}
                >
                  Back
                </button>
              </footer>
            </div>
          )}

          {authView === "verify" && (
            <div className="onboard">
              <header className="onboard-progress">
                <div className="onboard-progress-meta">
                  <span>Email confirmation</span>
                  <span>Almost there</span>
                </div>
                <div className="onboard-progress-track">
                  <div className="onboard-progress-fill" style={{ width: "100%" }} />
                </div>
              </header>
              <div className="onboard-hero">
                <h2 className="onboard-title">Enter your code</h2>
                <p className="onboard-support">
                  We sent a short code to {email || "your email"}. It expires in a
                  few minutes.
                </p>
              </div>
              <div className="onboard-body stack">
                <label className="field-block">
                  <span className="label">One-time code</span>
                  <input
                    id="otp"
                    className="field field-otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </label>
                {devCode && <p className="muted">Dev code: {devCode}</p>}
                <p className="trust-note">
                  After this, Admin reviews your documents before you can go on
                  duty.
                </p>
              </div>
              <footer className="onboard-footer">
                <button
                  className="btn btn-primary btn-block"
                  disabled={busy}
                  onClick={handleVerifyOtp}
                >
                  Confirm and finish
                </button>
                <button
                  className="btn btn-ghost btn-block"
                  type="button"
                  onClick={() => setAuthView("landing")}
                >
                  Back
                </button>
              </footer>
            </div>
          )}
        </div>
      </div>
    );
  }

  const appStatus = profile?.applicationStatus ?? "approved";
  const awaitingClearance =
    appStatus === "pending_review" ||
    appStatus === "needs_more_info" ||
    appStatus === "rejected" ||
    (profile?.eligibilityStatus === "pending" && appStatus !== "approved");

  if (awaitingClearance) {
    return (
      <div className="app">
        {error && <div className="banner banner-error">{error}</div>}
        <div className="app-shell stack">
          <h1 className="login-brand">
            <BrandLockup />
          </h1>
          <div className="onboard">
            <div className="onboard-hero">
              <h2 className="onboard-title">
                {appStatus === "rejected"
                  ? "Application not approved"
                  : appStatus === "needs_more_info"
                    ? "We need a bit more from you"
                    : "Waiting for approval"}
              </h2>
              <p className="onboard-support">
                {appStatus === "rejected"
                  ? profile?.reviewReason ||
                    "Please contact support if you have questions."
                  : "You’ll be able to go on duty after VUUSH clears your licence, insurance, and permits."}
              </p>
            </div>
            <p className="trust-note">Signed in as {user.email}</p>
            <footer className="onboard-footer">
              <button className="btn btn-ghost btn-block" onClick={signOut}>
                Sign out
              </button>
            </footer>
          </div>
        </div>
      </div>
    );
  }

  const action = job ? nextAction(job.state) : null;
  const needsProof =
    job &&
    (job.state === "ARRIVED_PICKUP" || job.state === "ARRIVED_DROPOFF");

  const pendingEarnings = earnings.filter(
    (e) => e.status === "pending" && !e.frozen,
  );
  const pendingTotalCents = pendingEarnings.reduce(
    (sum, e) => sum + e.amountCents,
    0,
  );
  const pendingCurrency = pendingEarnings[0]?.currency ?? "ZAR";

  return (
    <div className="app">
      {!online && (
        <div className="banner banner-offline">
          Offline / signal weak. Keep proofs for when you reconnect. Custody jobs stay with you.
        </div>
      )}
      {error && <div className="banner banner-error">{error}</div>}
      {notice && <div className="banner banner-ok">{notice}</div>}

      <div className="app-shell">
        <div className="topbar">
          <BrandLockup compact />
          <div className="topbar-actions">
            <button
              className="btn btn-ghost settings-btn"
              type="button"
              aria-label="Settings"
              title="Settings"
              onClick={() => {
                setTab("settings");
                void loadProfileSettings();
              }}
            >
              <SettingsGearIcon />
              <span>Settings</span>
            </button>
            <button className="btn btn-ghost" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>

        {tab === "home" && (
          <div className="stack">
            <div className="duty-hero">
              <div className="duty-hero-head">
                {profile?.photoUrl ? (
                  <img
                    className="duty-avatar"
                    src={profile.photoUrl}
                    alt=""
                    width={64}
                    height={64}
                  />
                ) : (
                  <div className="duty-avatar duty-avatar-fallback" aria-hidden>
                    {(profile?.publicName || user.displayName || "?")
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: 0 }}>
                    {profile?.onDuty ? "On duty" : "Off duty"}
                  </h2>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    {profile?.publicName || user.displayName || "Driver"}
                  </p>
                </div>
              </div>
              <p>
                {profile?.onDuty
                  ? "Waiting for your next assignment."
                  : "Go on duty when you’re ready to take jobs."}
              </p>
              <button className="btn btn-primary btn-block" disabled={busy || !profile} onClick={toggleDuty}>
                {profile?.onDuty ? "Go off duty" : "Go on duty"}
              </button>
              <button
                className="btn btn-secondary btn-block"
                type="button"
                style={{ marginTop: 8 }}
                onClick={() => {
                  void (async () => {
                    await unlockOfferAudio();
                    await startOfferAlert();
                    setNotice(
                      "Test ring for ~30s — Accept/Decline stops it on a real offer.",
                    );
                  })();
                }}
              >
                Test offer sound
              </button>
            </div>

            <div className="panel stack">
              <div className="row" style={{ alignItems: "center" }}>
                <h3 style={{ margin: 0, flex: 1 }}>Readiness</h3>
                <span className={`status-pill ${profile?.eligibilityStatus === "eligible" ? "ok" : "warn"}`}>
                  {profile?.eligibilityStatus ?? "pending"}
                </span>
              </div>
              <p className="muted">
                Vehicle {profile?.vehicleClass ?? "—"} · Zone {profile?.homeZoneCode ?? "—"}
              </p>
              <p className="muted mono">{user.email}</p>
            </div>

            {assignment?.status === "offered" && job && (
              <div className="panel stack">
                <span className="status-pill warn">New job offer</span>
                <h3>{job.publicCode}</h3>
                <p className="address">
                  <strong>Pickup</strong>
                  {job.pickupAddress}
                </p>
                <p className="address">
                  <strong>Dropoff</strong>
                  {job.dropoffAddress}
                </p>
                <p className="muted" style={{ textAlign: "center", margin: 0 }}>
                  Accept before the ring fills — then it declines automatically.
                </p>
                <div className="offer-actions">
                  <button
                    className="btn btn-secondary offer-decline"
                    disabled={busy}
                    type="button"
                    onClick={() => void handleReject()}
                  >
                    Decline
                  </button>
                  <button
                    className="offer-accept"
                    disabled={busy}
                    type="button"
                    style={{ ["--offer-fill"]: String(offerProgress) } as Record<
                      string,
                      string
                    >}
                    onClick={() => void handleAccept()}
                    aria-label={`Accept offer, ${Math.round((1 - offerProgress) * (OFFER_ALERT_MS / 1000))} seconds left`}
                  >
                    <svg className="offer-accept-ring" viewBox="0 0 100 100" aria-hidden>
                      <circle
                        className="offer-accept-track"
                        cx="50"
                        cy="50"
                        r="44"
                        fill="none"
                        strokeWidth="6"
                      />
                      <circle
                        className="offer-accept-fill"
                        cx="50"
                        cy="50"
                        r="44"
                        fill="none"
                        strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 44}`}
                        strokeDashoffset={`${2 * Math.PI * 44 * (1 - offerProgress)}`}
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <span className="offer-accept-label">Accept</span>
                  </button>
                </div>
              </div>
            )}

            {assignment?.status === "active" && job && (
              <div className="panel stack">
                <span className="status-pill">Active job</span>
                <h3>{job.publicCode}</h3>
                <p className="muted">{job.state.replaceAll("_", " ")}</p>
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    const target = navTarget ?? navTargetForJob(job);
                    const pre = openNavPlaceholder();
                    setTab("job");
                    tryAutoNav(
                      target,
                      `open:${assignment.id}:${target.leg}`,
                      pre,
                    );
                  }}
                >
                  Open job
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "job" && (
          <div className="stack">
            {!job || !assignment || assignment.status !== "active" ? (
              <div className="panel">
                <h2>No active job</h2>
                <p className="muted">When dispatch assigns you, the job shows here.</p>
              </div>
            ) : (
              <DriverJobCockpit
                job={job}
                sessionId={sessionId}
                navTarget={navTarget ?? navTargetForJob(job)}
                navBlocked={navBlocked}
                onClearNavBlocked={() => setNavBlocked(null)}
                needsProof={Boolean(needsProof)}
                proofNote={proofNote}
                setProofNote={setProofNote}
                action={action}
                busy={busy}
                failReason={failReason}
                setFailReason={setFailReason}
                onStep={handleStep}
                onFail={handleFail}
              />
            )}
          </div>
        )}

        {tab === "earnings" && (
          <div className="stack">
            {tripHistory ? (
              <div className="stack">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setTripHistory(null)}
                >
                  ← Back to earnings
                </button>
                <div className="panel stack">
                  <div className="row" style={{ alignItems: "center" }}>
                    <h2 style={{ margin: 0, flex: 1 }}>{tripHistory.job.publicCode}</h2>
                    <span className="status-pill">
                      {tripHistory.job.state.replaceAll("_", " ")}
                    </span>
                  </div>
                  {tripHistory.earning && (
                    <p style={{ margin: 0 }}>
                      <strong>
                        {formatMoney(
                          tripHistory.earning.amountCents,
                          tripHistory.earning.currency,
                        )}
                      </strong>
                      <span className="muted">
                        {" "}
                        · {tripHistory.earning.status}
                        {tripHistory.earning.frozen ? " · frozen" : ""}
                      </span>
                    </p>
                  )}
                  <p className="address" style={{ margin: 0 }}>
                    <strong>Pickup</strong>
                    {tripHistory.job.pickupAddress}
                  </p>
                  <p className="address" style={{ margin: 0 }}>
                    <strong>Dropoff</strong>
                    {tripHistory.job.dropoffAddress}
                  </p>
                  {tripHistory.job.recipientName && (
                    <p className="muted" style={{ margin: 0 }}>
                      Recipient {tripHistory.job.recipientName}
                    </p>
                  )}
                  <p className="muted" style={{ margin: 0 }}>
                    {tripHistory.job.packageClass} ·{" "}
                    {tripHistory.job.pickupZoneCode} → {tripHistory.job.dropoffZoneCode}
                  </p>
                </div>
                <div className="panel stack">
                  <h3>Trip notes / proofs</h3>
                  {tripHistory.proofs.length === 0 ? (
                    <p className="muted">No proof notes on file.</p>
                  ) : (
                    <ul className="list">
                      {tripHistory.proofs.map((p) => (
                        <li key={p.id}>
                          <div>
                            <div>{p.kind.replaceAll("_", " ")}</div>
                            <div className="muted">{p.note || "—"}</div>
                            <div className="muted mono">
                              {new Date(p.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="panel stack">
                  <h2>Pay</h2>
                  <p className="muted" style={{ margin: 0 }}>
                    Outstanding balance
                  </p>
                  <p className="earnings-dash-total">
                    {formatMoney(pendingTotalCents, pendingCurrency)}
                  </p>
                  <p className="muted" style={{ margin: 0 }}>
                    {pendingEarnings.length === 0
                      ? "Nothing waiting for payout yet."
                      : `${pendingEarnings.length} trip${pendingEarnings.length === 1 ? "" : "s"} pending payout · tap a trip for history`}
                  </p>
                  <button
                    className="btn btn-secondary btn-block"
                    disabled={busy}
                    onClick={() => void loadEarnings()}
                  >
                    Refresh
                  </button>
                </div>
                {earnings.length === 0 ? (
                  <div className="panel">
                    <p className="muted">No earning lines yet.</p>
                  </div>
                ) : (
                  <ul className="list">
                    {earnings.map((line) => (
                      <li key={line.id}>
                        <button
                          type="button"
                          className="earning-row"
                          onClick={() => void openTripHistory(line.jobId)}
                        >
                          <div style={{ textAlign: "left" }}>
                            <div className="mono">
                              {line.publicCode ?? line.jobId.slice(0, 8)}
                            </div>
                            <div className="muted">
                              {line.status}
                              {line.frozen ? " · frozen" : ""}
                              {line.pickupZoneCode
                                ? ` · ${line.pickupZoneCode} → ${line.dropoffZoneCode}`
                                : ""}
                            </div>
                          </div>
                          <strong>
                            {formatMoney(line.amountCents, line.currency)}
                          </strong>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div className="stack">
            <div className="panel stack">
              <h2>Professional profile</h2>
              <p className="muted" style={{ margin: 0 }}>
                Customers see this when you’re assigned to their delivery.
              </p>
              {profBundle?.professional && (
                <DriverProfessionalCard
                  driver={{
                    ...profBundle.professional,
                    publicName:
                      profDraft.publicName.trim() ||
                      profBundle.professional.publicName,
                    photoUrl: profDraft.photoUrl.trim() || null,
                    phone:
                      profDraft.phonePublic.trim() ||
                      profBundle.professional.phone,
                    vehicleLabel:
                      profDraft.vehicleLabel.trim() ||
                      profBundle.professional.vehicleLabel,
                    vehiclePlate:
                      profDraft.vehiclePlate.trim() ||
                      profBundle.professional.vehiclePlate,
                    bio: profDraft.bio.trim() || null,
                  }}
                  preview
                />
              )}
            </div>

            <div className="panel stack">
              <h3 style={{ margin: 0 }}>Edit profile</h3>
              <div className="photo-edit">
                {profDraft.photoUrl ? (
                  <img
                    className="photo-edit-preview"
                    src={profDraft.photoUrl}
                    alt=""
                    width={96}
                    height={96}
                  />
                ) : (
                  <div className="photo-edit-preview photo-edit-fallback" aria-hidden>
                    {(profDraft.publicName || "?").trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="photo-edit-actions stack">
                  <label className="btn btn-secondary btn-block photo-file-btn">
                    {profDraft.photoUrl ? "Change photo" : "Add photo"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        void (async () => {
                          try {
                            const dataUrl = await imageFileToPhotoDataUrl(file);
                            setProfDraft((d) => ({ ...d, photoUrl: dataUrl }));
                            setNotice("Photo ready — tap Save profile to publish.");
                            setError(null);
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : "photo_failed",
                            );
                          }
                        })();
                      }}
                    />
                  </label>
                  {profDraft.photoUrl ? (
                    <button
                      className="btn btn-ghost btn-block"
                      type="button"
                      onClick={() =>
                        setProfDraft((d) => ({ ...d, photoUrl: "" }))
                      }
                    >
                      Remove photo
                    </button>
                  ) : null}
                  <p className="muted" style={{ margin: 0 }}>
                    Customers see this on live tracking. Or paste an image link below.
                  </p>
                </div>
              </div>
              <label className="label" htmlFor="pub-name">
                Display name
              </label>
              <input
                id="pub-name"
                className="field"
                value={profDraft.publicName}
                onChange={(e) =>
                  setProfDraft((d) => ({ ...d, publicName: e.target.value }))
                }
              />
              <label className="label" htmlFor="photo-url">
                Photo link (optional)
              </label>
              <input
                id="photo-url"
                className="field"
                placeholder="https://…"
                value={
                  profDraft.photoUrl.startsWith("data:") ? "" : profDraft.photoUrl
                }
                onChange={(e) =>
                  setProfDraft((d) => ({ ...d, photoUrl: e.target.value }))
                }
              />
              <label className="label" htmlFor="phone-pub">
                Contact phone (public)
              </label>
              <input
                id="phone-pub"
                className="field"
                value={profDraft.phonePublic}
                onChange={(e) =>
                  setProfDraft((d) => ({ ...d, phonePublic: e.target.value }))
                }
              />
              <div>
                <span className="label">Account email</span>
                <p className="mono" style={{ margin: "4px 0 0" }}>
                  {profBundle?.user.email ?? "—"}
                </p>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  Email is shown on your professional card for this beachhead.
                </p>
              </div>
              <label className="label" htmlFor="veh-label">
                Vehicle
              </label>
              <input
                id="veh-label"
                className="field"
                placeholder="White Toyota Quantum"
                value={profDraft.vehicleLabel}
                onChange={(e) =>
                  setProfDraft((d) => ({ ...d, vehicleLabel: e.target.value }))
                }
              />
              <label className="label" htmlFor="veh-plate">
                Plate
              </label>
              <input
                id="veh-plate"
                className="field"
                value={profDraft.vehiclePlate}
                onChange={(e) =>
                  setProfDraft((d) => ({ ...d, vehiclePlate: e.target.value }))
                }
              />
              <label className="label" htmlFor="veh-class">
                Vehicle class
              </label>
              <select
                id="veh-class"
                className="field"
                value={profDraft.vehicleClass}
                onChange={(e) =>
                  setProfDraft((d) => ({ ...d, vehicleClass: e.target.value }))
                }
              >
                <option value="bike">Bike</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
              </select>
              <label className="label" htmlFor="home-zone">
                Home zone
              </label>
              <input
                id="home-zone"
                className="field"
                placeholder="CPT-CBD"
                value={profDraft.homeZoneCode}
                onChange={(e) =>
                  setProfDraft((d) => ({ ...d, homeZoneCode: e.target.value }))
                }
              />
              <label className="label" htmlFor="bio">
                Short bio
              </label>
              <textarea
                id="bio"
                className="field"
                rows={3}
                value={profDraft.bio}
                onChange={(e) =>
                  setProfDraft((d) => ({ ...d, bio: e.target.value }))
                }
              />
              <button
                className="btn btn-primary btn-block"
                type="button"
                disabled={busy}
                onClick={() => void saveProfileSettings()}
              >
                Save profile
              </button>
            </div>

            <div className="panel stack">
              <h3 style={{ margin: 0 }}>Documents</h3>
              <p className="muted" style={{ margin: 0 }}>
                Verification status (ops-managed for beachhead — view only).
              </p>
              <DocStatusRow
                label="Driver licence"
                status={profBundle?.profile.licenceStatus ?? "pending"}
              />
              <DocStatusRow
                label="Vehicle papers"
                status={profBundle?.profile.vehicleDocStatus ?? "pending"}
              />
              <DocStatusRow
                label="Insurance"
                status={profBundle?.profile.insuranceStatus ?? "pending"}
              />
            </div>
          </div>
        )}

        {tab === "emergency" && (
          <div className="stack">
            <div className="panel stack">
              <h2>Emergency</h2>
              <p className="lede" style={{ marginBottom: 0 }}>
                One thumb. Help first. This never looks like you did something wrong.
              </p>
            </div>
            {activeIncident ? (
              <div className="panel stack">
                <span className="status-pill danger">Help path active</span>
                <h3>{activeIncident.publicCode}</h3>
                <p className="muted">
                  {activeIncident.category} · {activeIncident.playbook} ·{" "}
                  {activeIncident.status}
                </p>
                {activeIncident.category === "threat" ? (
                  <p>
                    If you suspect mass-harm goods: move to a safe distance, call{" "}
                    <strong>local emergency services</strong>, then stay with this
                    screen. Do not take the parcel back via a normal return.
                  </p>
                ) : activeIncident.category === "medical" ? (
                  <p>
                    Medical diversion is authorised. Your job is paused. You will not
                    be punished for getting help.
                  </p>
                ) : (
                  <p>Stay safe. Dispatch has been notified. Follow local guidance.</p>
                )}
              </div>
            ) : (
              <>
                <div className="emergency-grid">
                  <button
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => handleEmergency("medical")}
                  >
                    Medical
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => handleEmergency("threat")}
                  >
                    Threat
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => handleEmergency("accident")}
                  >
                    Accident
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => handleEmergency("assault")}
                  >
                    Assault
                  </button>
                </div>
                <p className="muted">
                  Declaring freezes the active job, opens an incident for Dispatch, and
                  pauses the customer honestly.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <nav className="nav" aria-label="Driver">
        <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>
          Duty
        </button>
        <button className={tab === "job" ? "active" : ""} onClick={() => setTab("job")}>
          Job
        </button>
        <button
          className={tab === "earnings" ? "active" : ""}
          onClick={() => {
            setTab("earnings");
            void loadEarnings();
          }}
        >
          Pay
        </button>
        <button
          className={tab === "settings" ? "active" : ""}
          onClick={() => {
            setTab("settings");
            void loadProfileSettings();
          }}
        >
          Settings
        </button>
        <button
          className={`emergency ${tab === "emergency" ? "active" : ""}`}
          onClick={() => setTab("emergency")}
        >
          SOS
        </button>
      </nav>
    </div>
  );
}

function DriverJobCockpit(props: {
  job: Job;
  sessionId: string | null;
  navTarget: NavTarget;
  navBlocked: NavTarget | null;
  onClearNavBlocked: () => void;
  needsProof: boolean;
  proofNote: string;
  setProofNote: (v: string) => void;
  action: { label: string; step: string } | null;
  busy: boolean;
  failReason: string;
  setFailReason: (v: string) => void;
  onStep: (step: string) => void;
  onFail: () => void;
}) {
  const {
    job,
    sessionId,
    navTarget,
    navBlocked,
    needsProof,
    proofNote,
    setProofNote,
    action,
    busy,
    failReason,
    setFailReason,
    onStep,
    onFail,
  } = props;

  const markers = useMemo(() => {
    const list: MapMarker[] = [];
    if (job.pickupLat != null && job.pickupLng != null) {
      list.push({
        id: "pickup",
        lat: job.pickupLat,
        lng: job.pickupLng,
        kind: "pickup",
      });
    }
    if (job.dropoffLat != null && job.dropoffLng != null) {
      list.push({
        id: "dropoff",
        lat: job.dropoffLat,
        lng: job.dropoffLng,
        kind: "dropoff",
      });
    }
    return list;
  }, [job]);

  const lines = useMemo(() => {
    const out: MapLine[] = [];
    if (
      job.pickupLat != null &&
      job.pickupLng != null &&
      job.dropoffLat != null &&
      job.dropoffLng != null
    ) {
      out.push({
        id: "route",
        coords: [
          [job.pickupLng, job.pickupLat],
          [job.dropoffLng, job.dropoffLat],
        ],
      });
    }
    return out;
  }, [job]);

  return (
    <div className="driver-cockpit">
      {navBlocked && (
        <div className="nav-recover-inline panel stack" role="status">
          <strong>Maps ready</strong>
          <p style={{ margin: 0 }}>
            Next stop ({navBlocked.leg}): {navBlocked.address}
          </p>
          <a
            className="btn btn-primary btn-block"
            href={systemNavUrl(navBlocked)}
            target="_blank"
            rel="noreferrer"
            onClick={() => props.onClearNavBlocked()}
          >
            Tap to navigate
          </a>
          <button
            className="btn btn-ghost btn-block"
            type="button"
            onClick={props.onClearNavBlocked}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="driver-map-wrap">
        <SwiftMap className="driver-map" markers={markers} lines={lines} />
      </div>

      <div className="panel stack driver-sheet">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ margin: 0, flex: 1 }}>{job.publicCode}</h2>
          <span className="status-pill">{job.state.replaceAll("_", " ")}</span>
        </div>
        <a
          className="btn btn-primary btn-block"
          href={systemNavUrl(navTarget)}
          target="_blank"
          rel="noreferrer"
        >
          Navigate {navTarget.leg}
        </a>

        <p className="address" style={{ margin: 0 }}>
          <strong>Pickup</strong>
          <a
            href={systemNavUrl({
              lat: job.pickupLat,
              lng: job.pickupLng,
              address: job.pickupAddress,
            })}
            target="_blank"
            rel="noreferrer"
          >
            {job.pickupAddress}
          </a>
        </p>
        <p className="address" style={{ margin: 0 }}>
          <strong>Dropoff</strong>
          <a
            href={systemNavUrl({
              lat: job.dropoffLat,
              lng: job.dropoffLng,
              address: job.dropoffAddress,
            })}
            target="_blank"
            rel="noreferrer"
          >
            {job.dropoffAddress}
          </a>
        </p>
        {job.recipientName && (
          <p className="muted" style={{ margin: 0 }}>
            Recipient {job.recipientName}
            {job.recipientPhone ? ` · ${job.recipientPhone}` : ""}
          </p>
        )}
        {sessionId && <p className="muted mono">Tracking live</p>}

        {needsProof && (
          <div className="stack">
            <label className="label" htmlFor="proof">
              {job.state === "ARRIVED_PICKUP"
                ? "Pickup proof note (required)"
                : "Delivery / signature note (required)"}
            </label>
            <textarea
              id="proof"
              className="field"
              rows={3}
              value={proofNote}
              onChange={(e) => setProofNote(e.target.value)}
              placeholder={
                job.state === "ARRIVED_PICKUP"
                  ? "e.g. Parcel collected from reception"
                  : "e.g. Ada signed at door"
              }
            />
            {!proofNote.trim() && (
              <p className="muted" style={{ margin: 0 }}>
                Type a short note above — then Confirm unlocks.
              </p>
            )}
          </div>
        )}

        {action && (
          <button
            className="btn btn-primary btn-block"
            disabled={
              busy ||
              (needsProof && !proofNote.trim())
            }
            onClick={() => onStep(action.step)}
          >
            {action.label}
          </button>
        )}

        {["ARRIVED_DROPOFF", "IN_TRANSIT", "PICKED_UP"].includes(job.state) && (
          <div className="stack">
            <h3 style={{ marginBottom: 0 }}>Couldn’t deliver</h3>
            <select
              className="field"
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
            >
              <option value="customer_unavailable">Customer unavailable</option>
              <option value="wrong_address">Wrong address</option>
              <option value="access_blocked">Access blocked</option>
              <option value="refused">Refused</option>
            </select>
            <button className="btn btn-ghost btn-block" disabled={busy} onClick={onFail}>
              Record failed attempt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsGearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.77 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.69.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.26.12.55.02.69-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  );
}

function DocStatusRow(props: { label: string; status: string }) {
  const ok = props.status === "verified";
  return (
    <div className="row" style={{ alignItems: "center" }}>
      <span style={{ flex: 1 }}>{props.label}</span>
      <span className={`status-pill ${ok ? "ok" : "warn"}`}>
        {props.status.replaceAll("_", " ")}
      </span>
    </div>
  );
}

function DriverProfessionalCard(props: {
  driver: DriverProfessional;
  preview?: boolean;
}) {
  const { driver, preview } = props;
  const initial = (driver.publicName || "?").trim().charAt(0).toUpperCase();
  return (
    <div className={`driver-card${preview ? " driver-card-preview" : ""}`}>
      <div className="driver-card-head">
        {driver.photoUrl ? (
          <img
            className="driver-avatar"
            src={driver.photoUrl}
            alt=""
            width={56}
            height={56}
          />
        ) : (
          <div className="driver-avatar driver-avatar-fallback" aria-hidden>
            {initial}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 17 }}>{driver.publicName}</strong>
            {driver.docsVerified && (
              <span className="status-pill ok">Docs verified</span>
            )}
          </div>
          {driver.bio && (
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {driver.bio}
            </p>
          )}
        </div>
      </div>
      <dl className="driver-meta">
        {driver.phone && (
          <>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${driver.phone.replace(/\s/g, "")}`}>{driver.phone}</a>
            </dd>
          </>
        )}
        {driver.email && (
          <>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${driver.email}`}>{driver.email}</a>
            </dd>
          </>
        )}
        {(driver.vehicleLabel || driver.vehicleClass) && (
          <>
            <dt>Vehicle</dt>
            <dd>
              {driver.vehicleLabel ?? driver.vehicleClass}
              {driver.vehiclePlate ? ` · ${driver.vehiclePlate}` : ""}
            </dd>
          </>
        )}
        {driver.homeZoneCode && (
          <>
            <dt>Zone</dt>
            <dd>{driver.homeZoneCode}</dd>
          </>
        )}
      </dl>
      {!driver.docsVerified && (
        <p className="muted" style={{ margin: 0 }}>
          Licence {driver.licenceStatus} · Vehicle {driver.vehicleDocStatus} ·
          Insurance {driver.insuranceStatus}
        </p>
      )}
    </div>
  );
}
