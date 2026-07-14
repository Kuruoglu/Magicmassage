import { type ReactNode } from "react";

type AdminDrawerSectionProps = {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  description?: string;
  title?: string;
};

export function AdminDrawerSection({ ariaLabel, children, className = "", description, title }: AdminDrawerSectionProps) {
  const sectionClassName = ["admin-drawer-section", className].filter(Boolean).join(" ");

  return (
    <section aria-label={ariaLabel} className={sectionClassName}>
      {title ? (
        <div className="admin-drawer-section-head">
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
