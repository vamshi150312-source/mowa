import { useId, type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { filled?: boolean };

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export function HomeIcon({ filled, ...props }: IconProps) {
  return (
    <svg {...base(props)} fill={filled ? "currentColor" : "none"}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function SearchIcon({ filled, ...props }: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={filled ? 3 : 2}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function CreateIcon({ filled, ...props }: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={filled ? 2.6 : 2}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function HeartIcon({ filled, ...props }: IconProps) {
  return (
    <svg {...base(props)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.5 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
    </svg>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20.7 16.5A9 9 0 1 0 17.4 20l3.6 1-.3-4.5z" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M22 3 9.2 10.1M22 3l-7 18-3.8-8.9L2 9.5z" />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </svg>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function SoundOnIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function SoundOffIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      <path d="m16 9 6 6M22 9l-6 6" />
    </svg>
  );
}

/** Small badge marking a video tile in grids. */
export function VideoIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M4 5h11a2 2 0 0 1 2 2v2.5l4-2.5v10l-4-2.5V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={1.5}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.5-4.5L6 21" />
    </svg>
  );
}

/** Smiley with a plus: opens the reaction picker. */
export function ReactIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
      <path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2" />
      <path d="M9 9.5h.01M15 9.5h.01" strokeWidth={2.6} />
      <path d="M19 2.5v5M16.5 5h5" />
    </svg>
  );
}

export function PollIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h10M4 12h16M4 18h7" strokeWidth={2.6} />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2.6}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Leaf: Mindful mode. */
export function LeafIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 19c0-8 5.5-14 15-14 0 9.5-6 15-14 15" />
      <path d="M5 19c3-4 6-6.5 9.5-8.5" />
    </svg>
  );
}

/** Magic wand: filters. */
export function WandIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4 20 11-11M14 4v2M19 9h2M18.5 5.5 20 4M10 4.5l.5 1.5M18 13.5l1.5.5" />
      <path d="m13 7 4 4" />
    </svg>
  );
}

/** Clapperboard-style Reels icon. Filled, the details are cut out so it works on any background. */
export function ReelsIcon({ filled, ...props }: IconProps) {
  const maskId = useId();
  const details = (
    <>
      <path d="M3 8.5h18M8.5 3l3 5.5M14.5 3l3 5.5" />
      <path d="m10 12.2 4.5 2.6-4.5 2.6z" fill="currentColor" strokeWidth={1.2} />
    </>
  );
  if (!filled) {
    return (
      <svg {...base(props)}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        {details}
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <mask id={maskId}>
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <g stroke="black" fill="black">
          <path d="M3 8.5h18M8.5 3l3 5.5M14.5 3l3 5.5" fill="none" />
          <path d="m10 12.2 4.5 2.6-4.5 2.6z" strokeWidth={1.2} />
        </g>
      </mask>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" stroke="none" mask={`url(#${maskId})`} />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
    </svg>
  );
}

export function MusicIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="17" cy="16" r="3" fill="currentColor" />
    </svg>
  );
}

/** Direct messages: a speech bubble with a lightning zigzag. */
export function MessagesIcon({ filled, ...props }: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 2.8c-5.2 0-9.2 3.8-9.2 8.8 0 2.6 1.1 4.9 2.9 6.5v3.1l2.9-1.6c1 .3 2.1.5 3.4.5 5.2 0 9.2-3.8 9.2-8.8S17.2 2.8 12 2.8z"
        fill={filled ? "currentColor" : "none"}
      />
      <path d="m7 13.6 3.4-3.6 2.3 2.1 4.3-3.9" stroke={filled ? "white" : "currentColor"} />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 3.5h3.2l1.9 4.6-2.4 1.6a11.5 11.5 0 0 0 6.6 6.6l1.6-2.4 4.6 1.9v3.2A2 2 0 0 1 18.5 21 16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

/** Red "hang up" button icon: the phone handset turned down. */
export function HangUpIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 8.5c-3.6 0-6.9 1.2-9.3 3.3a1.5 1.5 0 0 0-.1 2.1l1.9 2a1.5 1.5 0 0 0 1.9.3l2.4-1.4a1.5 1.5 0 0 0 .7-1.3v-1.8a12 12 0 0 1 5 0v1.8c0 .5.3 1 .7 1.3l2.4 1.4a1.5 1.5 0 0 0 1.9-.3l1.9-2a1.5 1.5 0 0 0-.1-2.1A13.8 13.8 0 0 0 12 8.5z" />
    </svg>
  );
}

export function VideoCallIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="6" width="13.5" height="12" rx="2.5" />
      <path d="m15.5 10.2 6-3.7v11l-6-3.7z" />
    </svg>
  );
}

export function CameraOffIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 6h3a2.5 2.5 0 0 1 2.5 2.5v1.7l6-3.7v11l-1.5-.9M15.5 15.5A2.5 2.5 0 0 1 13 18H4.5A2.5 2.5 0 0 1 2 15.5v-7A2.5 2.5 0 0 1 4.5 6" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="2.5" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
    </svg>
  );
}

export function MicOffIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 9.5V5.5a3 3 0 0 0-5.7-1.3M9 9v2.5a3 3 0 0 0 4.9 2.3M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.5 2.6M12 18v3.5" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

/** Switch between front and back cameras. */
export function FlipCameraIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5" />
      <path d="M20 4v4.5h-4.5M4 20v-4.5h4.5" />
    </svg>
  );
}
