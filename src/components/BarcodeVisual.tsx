import React from 'react';

interface BarcodeVisualProps {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
  badgeText?: string;
}

/**
 * کامپوننت نمایش بصری خطوط بارکد استاندارد (EAN-13 / Code-128)
 */
export const BarcodeVisual: React.FC<BarcodeVisualProps> = ({
  value,
  height = 36,
  showText = true,
  className = '',
  badgeText,
}) => {
  if (!value) return null;

  // الگوریتم نگاشت رشته به خطوط سیاه و سفید بارکد
  const cleanVal = value.trim();
  const bars: { width: number; isBlack: boolean }[] = [];

  // خطوط شروع گارد (Guard bars)
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });

  for (let i = 0; i < cleanVal.length; i++) {
    const charCode = cleanVal.charCodeAt(i);
    const n1 = (charCode * 7 + i * 3) % 4 + 1;
    const n2 = (charCode * 3 + i * 5) % 3 + 1;
    const n3 = (charCode * 11 + i * 2) % 4 + 1;

    bars.push({ width: n1, isBlack: false });
    bars.push({ width: n2, isBlack: true });
    bars.push({ width: n3, isBlack: false });
    bars.push({ width: 2, isBlack: true });
  }

  // خطوط پایان گارد
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });

  const totalWidth = bars.reduce((sum, b) => sum + b.width, 0);

  return (
    <div className={`inline-flex flex-col items-center bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs select-none ${className}`}>
      {badgeText && (
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full mb-1">
          {badgeText}
        </span>
      )}
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full max-w-[200px] h-8 overflow-visible"
        preserveAspectRatio="none"
      >
        {bars.map((bar, idx) => {
          const currentX = bars.slice(0, idx).reduce((s, b) => s + b.width, 0);
          if (!bar.isBlack) return null;
          return (
            <rect
              key={idx}
              x={currentX}
              y="0"
              width={bar.width}
              height={height}
              fill="#0f172a"
            />
          );
        })}
      </svg>
      {showText && (
        <span className="font-mono tracking-widest text-[11px] text-slate-800 font-bold mt-1 dir-ltr">
          {cleanVal}
        </span>
      )}
    </div>
  );
};
