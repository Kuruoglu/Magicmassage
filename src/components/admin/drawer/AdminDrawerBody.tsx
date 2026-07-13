import { type ReactNode } from "react";

export function AdminDrawerBody({ children }: { children: ReactNode }) {
  return <div className="admin-drawer-body">{children}</div>;
}
