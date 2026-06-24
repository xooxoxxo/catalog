import { Popover } from "@base-ui/react/popover";
import type { ReactNode } from "react";
import { Tip } from "./Tip";

/** Icon button that opens a popover panel. Tooltip on hover, panel on click.
 *  Shows a count badge (number) or a dot (active) over the icon. */
export function IconPopover({ icon, label, active, badge, children }: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  children: ReactNode;
}) {
  const badgeNode =
    typeof badge === "number" && badge > 0 ? <span className="icon-badge num mono">{badge}</span>
    : active ? <span className="icon-badge dot" /> : null;
  return (
    <Popover.Root>
      <Tip label={label}>
        <Popover.Trigger className="tbtn icon">
          {icon}
          {badgeNode}
        </Popover.Trigger>
      </Tip>
      <Popover.Portal>
        <Popover.Positioner className="bui-pos" sideOffset={8} align="start">
          <Popover.Popup className="bui-popup">{children}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
