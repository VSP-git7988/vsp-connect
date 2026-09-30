// Site-wide aurora mesh: four soft blooms plus a static grain overlay, fixed
// behind all content. Blooms are pre-feathered radial gradients (no filter
// blur), so drifting them only moves composited layers and never repaints.
export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora-bloom aurora-violet" />
      <div className="aurora-bloom aurora-teal" />
      <div className="aurora-bloom aurora-amber" />
      <div className="aurora-bloom aurora-indigo" />
      <div className="aurora-grain" />
    </div>
  );
}
