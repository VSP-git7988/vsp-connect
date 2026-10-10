"use client";
import { Children, useId, useState, type ReactNode } from "react";

/**
 * Picks which region's settings form is shown. Every form is server-rendered;
 * this only toggles which one is visible.
 */
export function RegionSelect({
  regions,
  children,
}: {
  regions: [string, string][];
  children: ReactNode;
}) {
  const id = useId();
  const [active, setActive] = useState(regions[0]?.[0] ?? "");
  const panels = Children.toArray(children);
  return (
    <div className="admin-regions">
      <label className="admin-field" htmlFor={id}>
        <span>Region</span>
        <select
          id={id}
          value={active}
          onChange={(e) => setActive(e.target.value)}
        >
          {regions.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {panels.map((panel, i) => (
        <div key={regions[i]?.[0] ?? i} hidden={regions[i]?.[0] !== active}>
          {panel}
        </div>
      ))}
    </div>
  );
}
