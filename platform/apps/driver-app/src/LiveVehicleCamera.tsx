import { LiveCamera } from "./LiveCamera";

type Props = {
  value: string | null;
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
};

/** Live rear-camera vehicle photo — no gallery. */
export function LiveVehicleCamera(props: Props) {
  return (
    <LiveCamera
      label="Vehicle photo"
      help="Photograph your vehicle now. Gallery photos are not accepted."
      guide={[
        "Stand where the plate and side of the vehicle are clear",
        "Use daylight or a bright area",
        "Hold steady — one clear shot is enough",
      ]}
      facing="environment"
      captureLabel="Capture vehicle"
      {...props}
    />
  );
}
