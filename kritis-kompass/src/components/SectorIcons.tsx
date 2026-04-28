import type { SVGProps } from 'react';
import type { ModulePackIconKey } from '../data/modulePackCatalog';

// 10 simple Inline-SVG-Glyphen fuer die Branchen-Karten.
// Bewusst keine lucide-react-Icons hier — ein eigener Glyph pro Branche
// macht den Picker visuell pragnanter ohne Library-Aufschlag.

type IconProps = SVGProps<SVGSVGElement>;

function BaseSvg({ children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={28}
      height={28}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

function LightningIcon(props: IconProps) {
  return (
    <BaseSvg {...props}>
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </BaseSvg>
  );
}

function DropletIcon(props: IconProps) {
  return (
    <BaseSvg {...props}>
      <path d="M12 3c-3.5 4-6 7.4-6 10.6a6 6 0 0 0 12 0C18 10.4 15.5 7 12 3z" />
    </BaseSvg>
  );
}

function CrossIcon(props: IconProps) {
  return (
    <BaseSvg {...props}>
      <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
    </BaseSvg>
  );
}

function EuroIcon(props: IconProps) {
  return (
    <BaseSvg {...props}>
      <path d="M16 6a7 7 0 1 0 0 12" />
      <path d="M4 10h9" />
      <path d="M4 14h9" />
    </BaseSvg>
  );
}

function ChipIcon(props: IconProps) {
  return (
    <BaseSvg {...props}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </BaseSvg>
  );
}

function ArrowIcon(props: IconProps) {
  return (
    <BaseSvg {...props}>
      <path d="M3 12h15" />
      <path d="M13 6l6 6-6 6" />
    </BaseSvg>
  );
}

function GearIcon(props: IconProps) {
  return (
    <BaseSvg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
    </BaseSvg>
  );
}

function BuildingIcon(props: IconProps) {
  return (
    <BaseSvg {...props}>
      <path d="M4 22V4l8-2 8 2v18" />
      <path d="M9 22v-6h6v6" />
      <path d="M8 8h2M14 8h2M8 12h2M14 12h2" />
    </BaseSvg>
  );
}

function ShieldIcon(props: IconProps) {
  return (
    <BaseSvg {...props}>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </BaseSvg>
  );
}

function CompassIcon(props: IconProps) {
  return (
    <BaseSvg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5L12 12l-2.5 2.5L12 12 14.5 9.5z" fill="currentColor" />
    </BaseSvg>
  );
}

const ICON_MAP: Record<ModulePackIconKey, (props: IconProps) => JSX.Element> = {
  lightning: LightningIcon,
  droplet: DropletIcon,
  cross: CrossIcon,
  euro: EuroIcon,
  chip: ChipIcon,
  arrow: ArrowIcon,
  gear: GearIcon,
  building: BuildingIcon,
  shield: ShieldIcon,
  compass: CompassIcon,
};

interface SectorIconProps {
  iconKey: ModulePackIconKey;
  className?: string;
}

export function SectorIcon({ iconKey, className }: SectorIconProps) {
  const Component = ICON_MAP[iconKey];
  return <Component className={className} />;
}
