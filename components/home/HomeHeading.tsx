import type { ReactNode } from "react";

export default function HomeHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="home-heading">
      <span aria-hidden="true">❧</span>
      <span>{children}</span>
      <span aria-hidden="true">❧</span>
    </h2>
  );
}
