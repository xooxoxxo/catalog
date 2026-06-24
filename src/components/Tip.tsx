import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";

/** Instant styled tooltip around a single trigger element (e.g. an icon button). */
export function Tip({ label, children, side = "bottom" }: {
  label: string;
  children: ReactElement<Record<string, unknown>>;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner className="bui-pos" sideOffset={8} side={side}>
          <Tooltip.Popup className="bui-tooltip">{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
