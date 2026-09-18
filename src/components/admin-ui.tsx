import type { ReactNode } from "react";

/**
 * Small shared building blocks for the administration screens. Deliberately
 * plain: server-rendered forms posting to server actions, no client state.
 */
export function Field({
  label,
  name,
  defaultValue = "",
  type = "text",
  hint,
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="admin-field">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}

export function TextArea({
  label,
  name,
  defaultValue = "",
  rows = 4,
  hint,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="admin-field">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        required={required}
      />
    </label>
  );
}

export function Choice({
  label,
  name,
  defaultValue,
  options,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: [string, string][];
  hint?: string;
}) {
  return (
    <label className="admin-field">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <select name={name} defaultValue={defaultValue ?? ""}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="admin-toggle">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}

export function Card({
  title,
  meta,
  open = false,
  children,
}: {
  title: string;
  meta?: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="admin-card" open={open}>
      <summary>
        <strong>{title}</strong>
        {meta && <em>{meta}</em>}
      </summary>
      <div className="admin-card-body">{children}</div>
    </details>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="admin-empty">{children}</p>;
}
