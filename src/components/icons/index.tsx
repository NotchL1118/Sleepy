import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;
type SelectableIconProps = IconProps & { selected?: boolean };

export function ChevronIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
      aria-hidden="true"
    >
      <path d="m4.5 6 3.5 3.5L11.5 6" />
    </svg>
  );
}

export function CheckIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
      aria-hidden="true"
    >
      <path d="m3.5 8 3 3 6-6" />
    </svg>
  );
}

export function CrossIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      {...props}
      aria-hidden="true"
    >
      <path d="m4 4 8 8M12 4 4 12" />
    </svg>
  );
}

export function GitHubIcon({ className = "size-[18px]", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
      aria-hidden="true"
    >
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.04 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.74-1.55-2.57-.3-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.75 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.39-5.29 5.68.42.36.78 1.07.78 2.16v3.21c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  );
}

export function MenuIcon({ className = "size-5", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      {...props}
      aria-hidden="true"
    >
      <path d="M5 8h14M5 16h14" />
    </svg>
  );
}

export function MoonIcon({ className = "size-[17px]", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      {...props}
      aria-hidden="true"
    >
      <path d="M20.2 15.4A8.8 8.8 0 0 1 8.6 3.8 8.8 8.8 0 1 0 20.2 15.4Z" />
    </svg>
  );
}

export function SunIcon({ className = "size-[17px]", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      {...props}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </svg>
  );
}

export function UserIcon({ className = "size-3.5", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.1" />
      <path d="M6 19c.8-2.8 2.9-4.3 6-4.3s5.2 1.5 6 4.3" />
    </svg>
  );
}

function LineIcon({ className = "size-5", children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="m10 6-6 6 6 6M4 12h16" />
    </LineIcon>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4" rx="1.5" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    </LineIcon>
  );
}

export function DocumentIcon({ selected = false, ...props }: SelectableIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M6 3.5h8l4 4V20.5H6z" fill={selected ? "currentColor" : "none"} fillOpacity={selected ? 0.18 : undefined} />
      <path d="M14 3.5v4h4M9 12h6M9 16h6" />
    </LineIcon>
  );
}

export function HeartIcon({ selected = false, ...props }: SelectableIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M20.5 8.8c0 5-8.5 10.2-8.5 10.2S3.5 13.8 3.5 8.8A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 8.5 1.1Z" fill={selected ? "currentColor" : "none"} />
    </LineIcon>
  );
}

export function FolderIcon({ selected = false, ...props }: SelectableIconProps) {
  return (
    <LineIcon {...props}>
      {selected ? (
        <>
          <path d="M3.5 18.5v-12h6l2 2h8v3" />
          <path d="M3.5 18.5 6.5 12h15l-3 8H5a1.5 1.5 0 0 1-1.5-1.5Z" fill="currentColor" fillOpacity="0.18" />
        </>
      ) : <path d="M3.5 6.5h6l2 2h9v10.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" />}
    </LineIcon>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 4h7l9 9-7 7-9-9z" />
      <circle cx="8" cy="8" r="1" />
    </LineIcon>
  );
}

export function PageIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M5 3.5h10l4 4v13H5zM15 3.5v4h4" />
    </LineIcon>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 5.5h16v11H9l-5 4z" />
      <path d="M8 10h8M8 13.5h5" />
    </LineIcon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </LineIcon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 11.5 12 4.5l8 7V20a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20z" />
      <path d="M9.5 21.5v-7h5v7" />
    </LineIcon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </LineIcon>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </LineIcon>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M10 4H5v16h5M14 8l4 4-4 4M9 12h9" />
    </LineIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </LineIcon>
  );
}
