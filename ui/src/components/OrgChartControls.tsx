import type { ReactNode } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { t } from "@/i18n";

export interface OrgChartActions {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

/** Shared camera controls can stay mounted while the chart view fades away. */
export function OrgChartControls({ zoomIn, zoomOut, fit, children }: OrgChartActions & { children?: ReactNode }) {
  return (
    <div className="org-chart-controls flex items-center gap-2" role="group" aria-label={t("componentsOrgChartControls.controls")}>
      <div className="design-view-toggle" role="group" aria-label={t("componentsOrgChartControls.chartCamera")}>
        <Button variant="ghost" size="icon-sm" className="design-toolbar-icon" aria-label={t("componentsOrgChartControls.zoomOut")} title={t("componentsOrgChartControls.zoomOut")} onClick={zoomOut}><Minus className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" className="design-toolbar-icon" aria-label={t("componentsOrgChartControls.zoomIn")} title={t("componentsOrgChartControls.zoomIn")} onClick={zoomIn}><Plus className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" className="design-toolbar-icon" aria-label={t("componentsOrgChartControls.fit")} title={t("componentsOrgChartControls.fit")} onClick={fit}><Maximize2 className="size-4" /></Button>
      </div>
      {children}
    </div>
  );
}
