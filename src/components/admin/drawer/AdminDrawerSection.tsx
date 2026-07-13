import { type ReactNode } from "react";

type AdminDrawerSectionProps = {
  children: ReactNode;
  description?: string;
  title?: string;
};

export function AdminDrawerSection({ children, description, title }: AdminDrawerSectionProps) {
  return (
    <section className="admin-drawer-section">
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
