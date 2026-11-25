import { useState } from "react";
import { ChevronDown, Loader2, Settings2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "@/api/agents";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { AgentPanel } from "@/components/agent-detail/AgentPanels";
import { queryKeys } from "@/lib/queryKeys";
import { t } from "@/i18n";

type Field = "root" | "entry";
type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; root: string; entry: string }
  | { kind: "error"; field: Field | null; message: string };

export function checkExternalProfile(root: string, entry: string): { field: Field; message: string } | null {
  if (!root.startsWith("/") && !root.startsWith("~")) return { field: "root", message: t("pagesAgentDetail.bundle.absolutePath") };
  if (entry.startsWith("/") || entry.split(/[\\/]/).includes("..")) {
    return { field: "entry", message: t("pagesAgentDetail.bundle.entryInsideRoot") };
  }
  return null;
}

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export function InstructionsBundleSettings({
  agentId,
  agentUrlKey,
  companyId,
  mode,
  rootPath,
  entryFile,
  blocked,
  onSwitched,
}: {
  agentId: string;
  agentUrlKey?: string | null;
  companyId?: string;
  mode: "managed" | "external";
  rootPath: string;
  entryFile: string;
  blocked: boolean;
  onSwitched: () => void;
}) {
  const queryClient = useQueryClient();
  const [root, setRoot] = useState(mode === "external" ? rootPath : "");
  const [entry, setEntry] = useState(mode === "external" ? entryFile : "");
  const [load, setLoad] = useState<LoadState>({ kind: "idle" });
  const busy = load.kind === "loading";
  const trimmedRoot = root.trim();
  const trimmedEntry = entry.trim();
  const unchanged = mode === "external" && trimmedRoot === rootPath && trimmedEntry === entryFile;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.agents.instructionsBundle(agentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId) });
    if (agentUrlKey) queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentUrlKey) });
  };

  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (!busy) setLoad({ kind: "idle" });
  };

  const loadProfile = async () => {
    const problem = checkExternalProfile(trimmedRoot, trimmedEntry);
    if (problem) return setLoad({ kind: "error", ...problem });
    setLoad({ kind: "loading" });
    try {
      await agentsApi.updateInstructionsBundle(
        agentId,
        { mode: "external", rootPath: trimmedRoot, entryFile: trimmedEntry, requireExistingEntry: true },
        companyId,
      );
    } catch (error) {
      setLoad({ kind: "error", field: null, message: errorMessage(error, t("pagesAgentDetail.bundle.readFailed", { entry: trimmedEntry, root: trimmedRoot })) });
      return;
    }
    await refresh();
    onSwitched();
    setLoad({ kind: "loaded", root: trimmedRoot, entry: trimmedEntry });
  };

  const switchToManaged = async () => {
    setLoad({ kind: "loading" });
    try {
      await agentsApi.updateInstructionsBundle(agentId, { mode: "managed", rootPath: null, entryFile }, companyId);
      await refresh();
      onSwitched();
      setLoad({ kind: "idle" });
    } catch (error) {
      setLoad({ kind: "error", field: null, message: errorMessage(error, t("pagesAgentDetail.bundle.switchFailed")) });
    }
  };

  const invalid = (field: Field) => load.kind === "error" && load.field === field;

  return (
    <Collapsible defaultOpen={mode === "external"} className="flex flex-col gap-(--agent-detail-module-gap)">
      <CollapsibleTrigger className="group flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-foreground">
        <Settings2 className="size-4" aria-hidden />
        {t("pagesAgentDetail.bundle.advanced")}
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent data-agent-disclosure>
        <AgentPanel className="gap-4 p-(--agent-identity-panel-gap)" aria-label={t("pagesAgentDetail.bundle.external")}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t("pagesAgentDetail.bundle.external")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("pagesAgentDetail.bundle.externalHint")}</p>
          </div>
          <div className="grid gap-(--agent-detail-module-gap) sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{t("pagesAgentDetail.bundle.rootPath")}</span>
              <Input
                value={root}
                onChange={(event) => edit(setRoot)(event.target.value)}
                disabled={busy || blocked}
                aria-invalid={invalid("root") || undefined}
                placeholder="/absolute/path/to/agent/prompts"
                className="font-mono text-xs"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{t("pagesAgentDetail.bundle.rootFile")}</span>
              <Input
                value={entry}
                onChange={(event) => edit(setEntry)(event.target.value)}
                disabled={busy || blocked}
                aria-invalid={invalid("entry") || undefined}
                placeholder="AGENTS.md"
                className="font-mono text-xs"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {mode === "external" ? (
              <Button variant="ghost" size="sm" className="mr-auto -ml-3" onClick={() => void switchToManaged()} disabled={busy || blocked}>
                {t("pagesAgentDetail.bundle.useManaged")}
              </Button>
            ) : null}
            <p role="status" aria-live="polite" className="flex min-w-0 items-center gap-2 text-xs">
              {blocked ? <span className="text-muted-foreground">{t("pagesAgentDetail.bundle.saveFirst")}</span> : null}
              {!blocked && load.kind === "error" ? <span className="text-destructive">{load.message}</span> : null}
              {!blocked && load.kind === "loaded" ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-1.5 shrink-0 rounded-full bg-(--agent-detail-dot-saved)" aria-hidden />
                  {t("pagesAgentDetail.bundle.loaded", { entry: load.entry, root: load.root })}
                </span>
              ) : null}
            </p>
            <Button size="sm" onClick={() => void loadProfile()} disabled={!trimmedRoot || !trimmedEntry || busy || blocked || unchanged}>
              {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}
              {busy ? t("pagesAgentDetail.bundle.loading") : t("pagesAgentDetail.bundle.loadProfile")}
            </Button>
          </div>
        </AgentPanel>
      </CollapsibleContent>
    </Collapsible>
  );
}
