import { formatINR } from "@/lib/utils/pricing";
export { formatINR };

export interface PriceDisplayProps {
  amount: number;
  label?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  labelClassName?: string;
  prefixClassName?: string;
  suffixClassName?: string;
}

export default function PriceDisplay({
  amount,
  label,
  prefix,
  suffix,
  className,
  labelClassName,
  prefixClassName,
  suffixClassName,
}: PriceDisplayProps) {
  const formatted = formatINR(amount);

  if (label) {
    return (
      <div>
        <p className={labelClassName}>{label}</p>
        <p className={className}>
          {prefix && <span className={prefixClassName}>{prefix}</span>}
          {formatted}
          {suffix && <span className={suffixClassName}>{suffix}</span>}
        </p>
      </div>
    );
  }

  return (
    <p className={className}>
      {prefix && <span className={prefixClassName}>{prefix}</span>}
      <strong>{formatted}</strong>
      {suffix && <span className={suffixClassName}>{suffix}</span>}
    </p>
  );
}
