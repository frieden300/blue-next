import type { CSSProperties, ReactNode } from "react";

export interface ListingBadgeProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function ListingBadge({ children, className, style }: ListingBadgeProps) {
  if (!children) return null;
  return (
    <span className={className} style={style}>
      {children}
    </span>
  );
}

export function PartnerBadge({
  businessName,
  className,
}: {
  businessName?: string | null;
  className?: string;
}) {
  if (!businessName) return null;
  return <span className={className}>{businessName}</span>;
}
