# Icons

Inventory of shared SVG icons. Implementation: `index.tsx` only.

## Before adding

1. Check the table below; reuse an existing export when meaning matches or is close.
2. If nothing fits, add a named export in `index.tsx` and a row here in the same change.
3. Rename or delete: update this table in the same change.

Import shared icons from `@/components/icons`. Keep every icon as a named exported function in `index.tsx`; do not create per-icon files, duplicate SVGs inline in features or UI components, icon object maps, or a separate icon library package unless the task explicitly requires one.

Size and color icons through `className` and `currentColor`. Keep decorative icons `aria-hidden="true"` unless accessibility requires otherwise. Do not paste SVG paths into this README.

## Inventory

| Export | Purpose | Notes |
|--------|---------|--------|
| `ArrowLeftIcon` | Back navigation | Default `size-5` |
| `CheckIcon` | Selected option indicator | No default size; callers set `className` |
| `CrossIcon` | Failed action result | No default size; callers set `className` |
| `ChevronIcon` | Expand / dropdown affordance | No default size; callers set `className` |
| `CloseIcon` | Close a dialog or drawer | Default `size-5` |
| `ClockIcon` | Timeline navigation | Default `size-5` |
| `CommentIcon` | Comments and moderation | Default `size-5` |
| `DashboardIcon` | Studio overview / dashboard | Default `size-5` |
| `DocumentIcon` | Regular Posts | Default `size-5`; optional `selected` adds a filled paper surface |
| `FolderIcon` | Categories and Columns | Default `size-5`; optional `selected` shows an open folder |
| `GitHubIcon` | GitHub brand mark | Default `size-[18px]`; filled |
| `HeartIcon` | Heartworks | Default `size-5`; optional `selected` switches outline to filled |
| `HomeIcon` | Return to the public homepage | Default `size-5` |
| `LogOutIcon` | End the current session | Default `size-5` |
| `MenuIcon` | Open navigation menu | Default `size-5`; two-line stroke |
| `MoonIcon` | Dark theme affordance | Default `size-[17px]` |
| `MoreIcon` | More navigation entries | Default `size-5`; horizontal ellipsis |
| `PageIcon` | Standalone Pages | Default `size-5` |
| `SettingsIcon` | Site settings | Default `size-5` |
| `SunIcon` | Light theme affordance | Default `size-[17px]` |
| `TagIcon` | Tags | Default `size-5` |
| `UserIcon` | Guest / account avatar placeholder | Default `size-3.5` |
