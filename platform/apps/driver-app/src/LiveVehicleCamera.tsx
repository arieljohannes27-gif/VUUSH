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
      label="Vehicle photo — live only"
      help="Photograph your vehicle now. Old photos from your gallery are not allowed."
      facing="environment"
      {...props}
    />
  );
}
