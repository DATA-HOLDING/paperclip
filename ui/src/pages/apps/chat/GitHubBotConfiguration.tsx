import { copyTextToClipboard } from "@/lib/clipboard";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import {
  GITHUB_REVIEW_EVENTS,
  type GitHubChatConfiguration,
  type GitHubReviewPolicy,
  type GitHubAllowedPerson,
} from "@paperclipai/shared";
import { accessApi } from "@/api/access";
import { queryKeys } from "@/lib/queryKeys";
import { GitHubSponsorSelect } from "./GitHubSponsorSelect";
import { chatEndpointsApi } from "@/api/chatEndpoints";
import { githubChatApi } from "@/api/githubChat";
import { useOptionalCompany } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import {
  AtSign,
  Check,
  Copy,
  HelpCircle,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitHubSettingsDisclosure } from "./GitHubSettingsDisclosure";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { Label } from "@/components/ui/label";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Link } from "@/lib/router";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { describeError } from "@/api/errors";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export const githubSelectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const eventLabels = {
  opened: t("pagesAppsChatGitHubBotConfiguration.events.opened"),
  synchronize: t("pagesAppsChatGitHubBotConfiguration.events.synchronize"),
  reopened: t("pagesAppsChatGitHubBotConfiguration.events.reopened"),
  ready_for_review: t("pagesAppsChatGitHubBotConfiguration.events.readyForReview"),
  mention: t("pagesAppsChatGitHubBotConfiguration.events.mention"),
  comment: t("pagesAppsChatGitHubBotConfiguration.events.comment"),
};
function GitHubHelp({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t("pagesAppsChatGitHubBotConfiguration.help.about", { label })}
          className="inline-flex shrink-0 items-center text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <HelpCircle className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className={cn("max-w-xs", ANALYTICS_MASK_CLASS)}>{children}</TooltipContent>
    </Tooltip>
  );
}

export function GitHubToggle({
  label,
  description,
  help,
  checked,
  onChange,
  ariaLabel,
  disabled,
}: {
  label: string;
  description?: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="break-words text-sm font-medium">{label}</p>
          {help && <GitHubHelp label={label}>{help}</GitHubHelp>}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <ToggleSwitch
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  );
}
/** Keep separators while typing; the saved policy still contains normalized lists. */
function GitHubListInput({
  id,
  values,
  separator = "\n",
  onChange,
}: {
  id: string;
  values: string[];
  separator?: "\n" | ",";
  onChange: (values: string[]) => void;
}) {
  const joiner = separator === "," ? ", " : "\n";
  const [text, setText] = useState(values.join(joiner));
  const parse = (value: string) =>
    value
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean);
  useEffect(() => {
    setText((current) =>
      JSON.stringify(parse(current)) === JSON.stringify(values)
        ? current
        : values.join(joiner),
    );
  }, [values, separator]);
  const props = {
    id,
    value: text,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      setText(event.target.value);
      onChange(parse(event.target.value));
    },
  };
  return separator === "\n" ? <Textarea {...props} /> : <Input {...props} />;
}

function GitHubPassingScore({
  value,
  onChange,
  onValidityChange,
  text: controlledText,
  onTextChange,
}: {
  text?: string;
  onTextChange?: (text: string) => void;
  value: GitHubReviewPolicy["ratingThreshold"];
  onChange: (value: GitHubReviewPolicy["ratingThreshold"]) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const id = useId();
  const [localText, setLocalText] = useState(String(value ?? 5));
  const text = controlledText ?? localText;
  const setText = onTextChange ?? setLocalText;
  const number = Number(text);
  const valid = value === null || (text.trim() !== "" && Number.isInteger(number) && number >= 1 && number <= 5);
  useEffect(() => setLocalText(String(value ?? 5)), [value]);
  useEffect(() => { onValidityChange?.(valid); }, [valid, onValidityChange]);
  return (
    <div className="space-y-3 py-3">
      <Label htmlFor={id}>{t("pagesAppsChatGitHubBotConfiguration.score.label")}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Input id={id} type="number" min={1} max={5} step={1} required
            className="w-20" value={text} disabled={value === null}
            aria-invalid={!valid} aria-describedby={`${id}-help${valid ? "" : ` ${id}-error`}`}
            onChange={(event) => {
              const next = event.target.value;
              setText(next);
              const score = Number(next);
              if (next.trim() && Number.isInteger(score) && score >= 1 && score <= 5)
                onChange(score as 1 | 2 | 3 | 4 | 5);
            }} />
          <span className="text-sm text-muted-foreground">{t("pagesAppsChatGitHubBotConfiguration.score.outOf5")}</span>
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox aria-label={t("pagesAppsChatGitHubBotConfiguration.score.reportOnly")} checked={value === null}
            onCheckedChange={(checked) => { setText("5"); onChange(checked === true ? null : 5); }} />
          {t("pagesAppsChatGitHubBotConfiguration.score.reportOnly")}
        </Label>
      </div>
      {!valid && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{t("pagesAppsChatGitHubBotConfiguration.score.invalid")}</p>}
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {value === null
          ? t("pagesAppsChatGitHubBotConfiguration.score.helpReportOnly")
          : t("pagesAppsChatGitHubBotConfiguration.score.helpScore")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("pagesAppsChatGitHubBotConfiguration.score.blockMergingBefore")} <strong>Paperclip Review</strong> {t("pagesAppsChatGitHubBotConfiguration.score.blockMergingAfter")}{" "}
        <a className="underline hover:text-foreground"
          href="https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository"
          target="_blank" rel="noreferrer">{t("pagesAppsChatGitHubBotConfiguration.score.configureOnGitHub")}</a>
      </p>
    </div>
  );
}

export function GitHubPolicyEditor({
  policy,
  onChange,
  accessHref,
  onValidityChange,
  scoreText,
  onScoreTextChange,
  rememberedAutomaticMode,
  readOnly = false,
}: {
  accessHref?: string;
  readOnly?: boolean;
  scoreText?: string;
  onScoreTextChange?: (text: string) => void;
  rememberedAutomaticMode?: "linked_authors" | "allowed_authors";
  policy: GitHubReviewPolicy;
  onChange: (policy: GitHubReviewPolicy) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const id = useId();
  const automaticMode = useRef<"linked_authors" | "allowed_authors">(
    "linked_authors",
  );
  if (policy.invocation !== "mentions_only")
    automaticMode.current = policy.invocation;
  const filterField = (
    key:
      | "includeAuthors"
      | "excludeAuthors"
      | "targetBranches"
      | "excludedBranches"
      | "requiredLabels"
      | "excludedLabels"
      | "ignoredPaths",
    label: string,
    help: string,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`${id}-github-${key}`}>{label}</Label>
      <GitHubListInput
        id={`${id}-github-${key}`}
        values={policy[key]}
        onChange={(values) => set(key, values)}
      />
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
  const [prompt, setPrompt] = useState<
    (typeof GITHUB_REVIEW_EVENTS)[number] | "issue_opened"
  >("opened");
  const set = <K extends keyof GitHubReviewPolicy>(
    key: K,
    value: GitHubReviewPolicy[K],
  ) => onChange({ ...policy, [key]: value });
  return (
    <div className="space-y-8">
      <section
        className="space-y-3"
        aria-labelledby={`${id}-github-instructions-heading`}
      >
        <h2
          id={`${id}-github-instructions-heading`}
          className="text-base font-semibold"
        >
          {t("pagesAppsChatGitHubBotConfiguration.policy.instructions.heading")}
        </h2>
        <MarkdownEditor
          readOnly={readOnly}
          ariaLabel={t("pagesAppsChatGitHubBotConfiguration.policy.instructions.ariaLabel")}
          contentClassName="min-h-32"
          value={policy.instructions}
          placeholder={t("pagesAppsChatGitHubBotConfiguration.policy.instructions.placeholder")}
          onChange={(value) => set("instructions", value)}
        />
        <p className="text-xs text-muted-foreground">
          {t("pagesAppsChatGitHubBotConfiguration.policy.instructions.help")}
        </p>
        <GitHubSettingsDisclosure title={t("pagesAppsChatGitHubBotConfiguration.policy.instructions.eventSpecific")}>
          <div className="grid gap-3 pt-3">
            <Label htmlFor={`${id}-github-prompt-event`} className="sr-only">
              {t("pagesAppsChatGitHubBotConfiguration.policy.instructions.event")}
            </Label>
            <select
              id={`${id}-github-prompt-event`}
              className={githubSelectClass}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value as typeof prompt)}
            >
              {GITHUB_REVIEW_EVENTS.map((event) => (
                <option key={event} value={event}>
                  {eventLabels[event]}
                </option>
              ))}
              <option value="issue_opened">{t("pagesAppsChatGitHubBotConfiguration.events.issueOpened")}</option>
            </select>
            <MarkdownEditor
              key={prompt}
              readOnly={readOnly}
              ariaLabel={t("pagesAppsChatGitHubBotConfiguration.policy.instructions.eventAriaLabel", { event: prompt === "issue_opened" ? t("pagesAppsChatGitHubBotConfiguration.events.issueOpened") : eventLabels[prompt] })}
              contentClassName="min-h-32"
              value={
                prompt === "issue_opened"
                  ? (policy.issueOpenedInstructions ?? "")
                  : policy.prompts[prompt]
              }
              onChange={(value) =>
                prompt === "issue_opened"
                  ? set("issueOpenedInstructions", value)
                  : set("prompts", {
                      ...policy.prompts,
                      [prompt]: value,
                    })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("pagesAppsChatGitHubBotConfiguration.policy.instructions.eventHelp")}
            </p>
          </div>
        </GitHubSettingsDisclosure>
      </section>
      <section
        className="space-y-3"
        aria-labelledby={`${id}-github-triggers-heading`}
      >
        <h2
          id={`${id}-github-triggers-heading`}
          className="text-base font-semibold"
        >
          {t("pagesAppsChatGitHubBotConfiguration.policy.triggers.heading")}
        </h2>
        <div className="flex items-start gap-3 py-2">
          <AtSign className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("pagesAppsChatGitHubBotConfiguration.policy.triggers.whenMentioned")}</p>
            <p className="text-xs text-muted-foreground">
              {t("pagesAppsChatGitHubBotConfiguration.policy.triggers.mentionHelp")}{" "}
              {accessHref && (
                <Link className="underline underline-offset-4" to={accessHref}>
                  {t("pagesAppsChatGitHubBotConfiguration.policy.triggers.manageAccess")}
                </Link>
              )}
            </p>
          </div>
        </div>
        <GitHubToggle
          label={t("pagesAppsChatGitHubBotConfiguration.policy.triggers.runAutomatically")}
          description={t("pagesAppsChatGitHubBotConfiguration.policy.triggers.runAutomaticallyDescription")}
          checked={policy.invocation !== "mentions_only"}
          onChange={(enabled) =>
            set("invocation", enabled ? (rememberedAutomaticMode ?? automaticMode.current) : "mentions_only")
          }
        />
        {policy.invocation !== "mentions_only" && (
          <div className="space-y-4">
            <div
              className="grid gap-x-6 gap-y-3 sm:grid-cols-2"
              aria-label={t("pagesAppsChatGitHubBotConfiguration.policy.triggers.automaticEvents")}
            >
              {GITHUB_REVIEW_EVENTS.slice(0, 4).map((event) => (
                <Label
                  key={event}
                  className="flex cursor-pointer items-center gap-3 text-sm font-normal"
                >
                  <Checkbox
                    checked={policy.events.includes(event)}
                    onCheckedChange={(enabled) =>
                      set(
                        "events",
                        enabled === true
                          ? [...new Set([...policy.events, event])]
                          : policy.events.filter((value) => value !== event),
                      )
                    }
                  />
                  {eventLabels[event]}
                </Label>
              ))}
              <Label className="flex cursor-pointer items-center gap-3 text-sm font-normal">
                <Checkbox
                  checked={policy.issueOpened === true}
                  onCheckedChange={(enabled) =>
                    set("issueOpened", enabled === true)
                  }
                />
                {t("pagesAppsChatGitHubBotConfiguration.policy.triggers.newIssues")}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("pagesAppsChatGitHubBotConfiguration.policy.triggers.automaticHelp")}
            </p>
            <GitHubSettingsDisclosure title={t("pagesAppsChatGitHubBotConfiguration.policy.filters.title")}>
              <div>
                <GitHubToggle
                  label={t("pagesAppsChatGitHubBotConfiguration.policy.filters.includeDrafts")}
                  checked={policy.reviewDrafts}
                  onChange={(value) => set("reviewDrafts", value)}
                />
                <GitHubToggle
                  label={t("pagesAppsChatGitHubBotConfiguration.policy.filters.includeBots")}
                  description={t("pagesAppsChatGitHubBotConfiguration.policy.filters.includeBotsDescription")}
                  checked={policy.reviewBotAuthors}
                  onChange={(value) => set("reviewBotAuthors", value)}
                />
              </div>
              <GitHubSettingsDisclosure title={t("pagesAppsChatGitHubBotConfiguration.policy.filters.authors")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {filterField(
                    "includeAuthors",
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.includedAuthors"),
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.includedAuthorsHelp"),
                  )}
                  {filterField(
                    "excludeAuthors",
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.excludedAuthors"),
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.excludedAuthorsHelp"),
                  )}
                </div>
              </GitHubSettingsDisclosure>
              <GitHubSettingsDisclosure title={t("pagesAppsChatGitHubBotConfiguration.policy.filters.branches")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {filterField(
                    "targetBranches",
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.targetBranches"),
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.targetBranchesHelp"),
                  )}
                  {filterField(
                    "excludedBranches",
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.excludedBranches"),
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.excludedBranchesHelp"),
                  )}
                </div>
              </GitHubSettingsDisclosure>
              <GitHubSettingsDisclosure title={t("pagesAppsChatGitHubBotConfiguration.policy.filters.labels")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {filterField(
                    "requiredLabels",
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.requiredLabels"),
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.requiredLabelsHelp"),
                  )}
                  {filterField(
                    "excludedLabels",
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.excludedLabels"),
                    t("pagesAppsChatGitHubBotConfiguration.policy.filters.excludedLabelsHelp"),
                  )}
                </div>
              </GitHubSettingsDisclosure>
              <p className="text-xs text-muted-foreground">
                {t("pagesAppsChatGitHubBotConfiguration.policy.filters.mentionBypass")}
              </p>
            </GitHubSettingsDisclosure>
          </div>
        )}
      </section>
      <section
        className="space-y-3"
        aria-labelledby={`${id}-github-results-heading`}
      >
        <h2
          id={`${id}-github-results-heading`}
          className="text-base font-semibold"
        >
          {t("pagesAppsChatGitHubBotConfiguration.policy.results.heading")}
        </h2>
        <div className="grid gap-x-8 sm:grid-cols-2">
          <GitHubToggle
            label={t("pagesAppsChatGitHubBotConfiguration.policy.results.postSummary")}
            checked={policy.publishSummary}
            onChange={(value) => set("publishSummary", value)}
          />
          <GitHubToggle
            label={t("pagesAppsChatGitHubBotConfiguration.policy.results.postInline")}
            checked={policy.publishInline}
            onChange={(value) => set("publishInline", value)}
          />
        </div>
        <GitHubPassingScore value={policy.ratingThreshold} text={scoreText} onTextChange={onScoreTextChange}
          onChange={(value) => set("ratingThreshold", value)} onValidityChange={onValidityChange} />
      </section>
      <div className="divide-y divide-border">
        <GitHubSettingsDisclosure title={t("pagesAppsChatGitHubBotConfiguration.policy.ignored.title")}>
          {filterField(
            "ignoredPaths",
            t("pagesAppsChatGitHubBotConfiguration.policy.ignored.filePatterns"),
            t("pagesAppsChatGitHubBotConfiguration.policy.ignored.filePatternsHelp"),
          )}
        </GitHubSettingsDisclosure>
        <GitHubSettingsDisclosure title={t("pagesAppsChatGitHubBotConfiguration.policy.inline.title")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${id}-github-categories`}>
                {t("pagesAppsChatGitHubBotConfiguration.policy.inline.findingCategories")}
              </Label>
              <GitHubListInput
                id={`${id}-github-categories`}
                values={policy.findingCategories}
                separator=","
                onChange={(values) => set("findingCategories", values)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-github-severity`}>
                {t("pagesAppsChatGitHubBotConfiguration.policy.inline.minimumSeverity")}
              </Label>
              <select
                id={`${id}-github-severity`}
                className={githubSelectClass}
                value={policy.minimumCommentSeverity}
                onChange={(e) =>
                  set(
                    "minimumCommentSeverity",
                    e.target
                      .value as GitHubReviewPolicy["minimumCommentSeverity"],
                  )
                }
              >
                <option value="info">{t("pagesAppsChatGitHubBotConfiguration.policy.inline.severity.info")}</option>
                <option value="warning">{t("pagesAppsChatGitHubBotConfiguration.policy.inline.severity.warning")}</option>
                <option value="error">{t("pagesAppsChatGitHubBotConfiguration.policy.inline.severity.error")}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {t("pagesAppsChatGitHubBotConfiguration.policy.inline.hiddenFindings")}
              </p>
            </div>
          </div>
        </GitHubSettingsDisclosure>
        <GitHubSettingsDisclosure title={t("pagesAppsChatGitHubBotConfiguration.policy.decisions.title")}>
          <p className="text-xs text-muted-foreground">
            {t("pagesAppsChatGitHubBotConfiguration.policy.decisions.description")}
          </p>
          <div>
            <GitHubToggle
              label={t("pagesAppsChatGitHubBotConfiguration.policy.decisions.allowApprovals")}
              help={t("pagesAppsChatGitHubBotConfiguration.policy.decisions.allowApprovalsHelp")}
              checked={policy.allowApprove}
              onChange={(value) => set("allowApprove", value)}
            />
            <GitHubToggle
              label={t("pagesAppsChatGitHubBotConfiguration.policy.decisions.allowRequestChanges")}
              help={t("pagesAppsChatGitHubBotConfiguration.policy.decisions.allowRequestChangesHelp")}
              checked={policy.allowRequestChanges}
              onChange={(value) => set("allowRequestChanges", value)}
            />
          </div>
        </GitHubSettingsDisclosure>
      </div>
    </div>
  );
}

export function GitHubAccessEditor({
  endpointId,
  companyId,
  configuration,
  onChange,
}: {
  endpointId: string;
  companyId: string;
  configuration: GitHubChatConfiguration;
  onChange: (configuration: GitHubChatConfiguration) => void;
}) {
  const company = useOptionalCompany()?.companies.find((item) => item.id === companyId);
  const accountLink = useRef<HTMLAnchorElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [dialog, setDialog] = useState<"member" | "guest" | null>(null);
  const members = useQuery({
    queryKey: ["github-members", companyId],
    queryFn: () => accessApi.listMembers(companyId),
  });
  const boardAccess = useQuery({
    queryKey: queryKeys.access.currentBoardAccess,
    queryFn: () => accessApi.getCurrentBoardAccess(),
  });
  const links = useQuery({
    queryKey: ["github-linked-members", endpointId],
    queryFn: () => chatEndpointsApi.listPrincipals(endpointId),
  });
  const membersView = useQueryView(members);
  const linksView = useQueryView(links);
  const boardAccessView = useQueryView(boardAccess);
  const linksLoaded = linksView.kind === "ready" || linksView.kind === "stale";
  const [login, setLogin] = useState("");
  const [sponsor, setSponsor] = useState("");
  const guestSponsor = sponsor || boardAccess.data?.userId || "";
  const [candidate, setCandidate] = useState<{
    githubUserId: string;
    login: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [busy, setBusy] = useState(false);
  const activeMembers = (members.data?.members ?? []).filter(
    (member) =>
      member.status === "active" && member.membershipRole !== "viewer",
  );
  const linkedAccounts = (links.data ?? []).filter(
    (link) => link.status === "linked",
  );
  const responsible = activeMembers.find(
    (member) => member.principalId === configuration.responsibleUserId,
  );
  const memberName = (userId: string) =>
    activeMembers.find((member) => member.principalId === userId)?.user?.name ??
    userId;
  const automatic = configuration.defaults.invocation !== "mentions_only";
  const guestsAutomatic =
    configuration.defaults.invocation === "allowed_authors";
  const guests = configuration.people.filter(
    (person) => person.kind === "guest",
  );
  // Preserve configured members whose identity link was revoked; show why they cannot run.
  const memberRows = [
    ...configuration.people.filter((person) => person.kind === "member"),
    ...linkedAccounts
      .filter(
        (link) =>
          link.githubUserId &&
          link.paperclipUserId &&
          !configuration.people.some(
            (person) => person.githubUserId === link.githubUserId,
          ),
      )
      .map((link): GitHubAllowedPerson => ({
        kind: "member",
        userId: link.paperclipUserId!,
        githubUserId: link.githubUserId!,
        login: link.githubLogin ?? link.externalLabel,
      })),
  ];
  const updatePerson = (person: GitHubAllowedPerson) =>
    onChange({
      ...configuration,
      people: configuration.people.some(
        (p) => p.githubUserId === person.githubUserId,
      )
        ? configuration.people.map((p) =>
            p.githubUserId === person.githubUserId ? person : p,
          )
        : [...configuration.people, person],
    });
  const removePerson = (person: GitHubAllowedPerson) =>
    onChange({
      ...configuration,
      people: configuration.people.filter(
        (p) => p.githubUserId !== person.githubUserId,
      ),
    });
  const unlink = async (principalId: string) => {
    setBusy(true);
    setError("");
    try {
      await chatEndpointsApi.revokeLink(endpointId, principalId);
      await links.refetch();
    } catch (e) {
      setError(
        describeError(e).body,
      );
    } finally {
      setBusy(false);
    }
  };
  const peopleRows = (people: GitHubAllowedPerson[]) => (
    <div className="divide-y divide-border">
      {people.map((person) => {
        const identity = linkedAccounts.find(
          (link) => link.githubUserId === person.githubUserId,
        );
        const linked = person.kind === "guest" || Boolean(identity);
        const explicit = configuration.people.some(
          (p) => p.githubUserId === person.githubUserId,
        );
        const mentions =
          person.kind === "guest" ||
          configuration.memberAccess === "all_linked" ||
          explicit;
        const removable = explicit && (person.kind === "guest" || configuration.memberAccess === "selected");
        return (
          <div
            key={person.githubUserId}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4"
          >
            <div className="min-w-0 flex-1 basis-32">
              <p className={cn("break-words text-sm font-medium", ANALYTICS_MASK_CLASS)}>@{person.login}</p>
              <p className="text-xs text-muted-foreground">
                {person.kind === "guest"
                  ? t("pagesAppsChatGitHubBotConfiguration.access.sponsoredBy", { name: memberName(person.sponsorUserId) })
                  : (identity?.paperclipUserLabel ?? t("pagesAppsChatGitHubBotConfiguration.access.companyMember"))}
              </p>
              {!linked && (
                <p className="mt-1 text-xs text-destructive">
                  {t("pagesAppsChatGitHubBotConfiguration.access.needsLinking")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("pagesAppsChatGitHubBotConfiguration.access.mentions")}</span>
                {person.kind === "guest" ||
                configuration.memberAccess === "all_linked" ? (
                  <span
                    className="flex h-5 items-center gap-1 text-xs"
                    aria-label={linked ? t("pagesAppsChatGitHubBotConfiguration.access.mentionsAllowedFor", { login: person.login }) : t("pagesAppsChatGitHubBotConfiguration.access.mentionsUnavailableFor", { login: person.login })}
                  >
                    {linked && (
                      <Check className="size-3.5 text-muted-foreground" />
                    )}
                    {linked ? t("pagesAppsChatGitHubBotConfiguration.access.allowed") : t("pagesAppsChatGitHubBotConfiguration.access.unlinked")}
                  </span>
                ) : (
                  <ToggleSwitch
                    aria-label={t("pagesAppsChatGitHubBotConfiguration.access.allowMentionsFrom", { login: person.login })}
                    checked={mentions}
                    disabled={!linked}
                    onCheckedChange={(enabled) =>
                      enabled ? updatePerson(person) : removePerson(person)
                    }
                  />
                )}
              </div>
              {(identity || removable) && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("pagesAppsChatGitHubBotConfiguration.access.manage", { login: person.login })}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className={ANALYTICS_MASK_CLASS} align="end">
                  {removable && (
                    <DropdownMenuItem onClick={() => removePerson(person)}>
                      {t("pagesAppsChatGitHubBotConfiguration.access.removeAccess")}
                    </DropdownMenuItem>
                  )}
                  {identity && (
                    <DropdownMenuItem
                      disabled={busy}
                      onClick={() => void unlink(identity.principalId)}
                    >
                      {t("pagesAppsChatGitHubBotConfiguration.access.unlinkAccount")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>}
            </div>
          </div>
        );
      })}
    </div>
  );
  return (
    <section className="space-y-6" aria-label={t("pagesAppsChatGitHubBotConfiguration.access.people")}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{t("pagesAppsChatGitHubBotConfiguration.access.people")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsChatGitHubBotConfiguration.access.peopleDescription")}
        </p>
      </div>
      <section className="space-y-2" aria-label={t("pagesAppsChatGitHubBotConfiguration.access.companyMembers")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("pagesAppsChatGitHubBotConfiguration.access.companyMembers")}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDialog("member");
              setLinkCopied(false);
              setError("");
            }}
          >
            <Plus className="size-4" />
            {t("pagesAppsChatGitHubBotConfiguration.access.linkMember")}
          </Button>
        </div>
        <GitHubToggle
          label={t("pagesAppsChatGitHubBotConfiguration.access.allowAllLinked")}
          description={
            configuration.memberAccess === "all_linked"
              ? t("pagesAppsChatGitHubBotConfiguration.access.allowAllLinkedOn", { company: company?.name ?? t("pagesAppsChatGitHubBotConfiguration.access.thisCompany") })
              : t("pagesAppsChatGitHubBotConfiguration.access.allowAllLinkedOff")
          }
          checked={configuration.memberAccess === "all_linked"}
          onChange={(enabled) =>
            onChange({
              ...configuration,
              memberAccess: enabled ? "all_linked" : "selected",
            })
          }
        />
        {peopleRows(memberRows)}
        {(links.isPending || linksView.kind === "reconnecting") && (
          <p role="status" className="py-4 text-sm text-muted-foreground">
            {t("pagesAppsChatGitHubBotConfiguration.access.loadingLinked")}
          </p>
        )}
        {linksLoaded && memberRows.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            {t("pagesAppsChatGitHubBotConfiguration.access.noMembersLinked")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {automatic ? (
            <>
              {t("pagesAppsChatGitHubBotConfiguration.access.automaticOnBefore")}{" "}
              <Link
                className="underline underline-offset-4"
                to={`/apps/chat/${endpointId}/settings`}
              >
                {t("pagesAppsChatGitHubBotConfiguration.access.settingsLink")}
              </Link>
              .
            </>
          ) : (
            <>
              {t("pagesAppsChatGitHubBotConfiguration.access.automaticOffBefore")}{" "}
              <Link
                className="underline underline-offset-4"
                to={`/apps/chat/${endpointId}/settings`}
              >
                {t("pagesAppsChatGitHubBotConfiguration.access.settingsLink")}
              </Link>
              {t("pagesAppsChatGitHubBotConfiguration.access.automaticOffAfter")}
            </>
          )}
        </p>
      </section>
      <section
        className="space-y-2 border-t border-border pt-6"
        aria-label={t("pagesAppsChatGitHubBotConfiguration.access.externalContributors")}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("pagesAppsChatGitHubBotConfiguration.access.externalContributors")}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSponsor(boardAccess.data?.userId ?? "");
              setDialog("guest");
              setLookupError("");
            }}
          >
            <Plus className="size-4" />
            {t("pagesAppsChatGitHubBotConfiguration.access.addExternal")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("pagesAppsChatGitHubBotConfiguration.access.externalDescription")}
        </p>
        {peopleRows(guests)}
        {guests.length > 0 && (
          <GitHubToggle
            label={t("pagesAppsChatGitHubBotConfiguration.access.allowExternalAutomatic")}
            description={
              automatic
                ? t("pagesAppsChatGitHubBotConfiguration.access.allowExternalAutomaticOn")
                : t("pagesAppsChatGitHubBotConfiguration.access.allowExternalAutomaticOff")
            }
            checked={guestsAutomatic}
            disabled={!automatic}
            onChange={(enabled) =>
              onChange({
                ...configuration,
                defaults: {
                  ...configuration.defaults,
                  invocation: enabled ? "allowed_authors" : "linked_authors",
                },
              })
            }
          />
        )}
      </section>
      <GitHubSettingsDisclosure title={t("pagesAppsChatGitHubBotConfiguration.access.responsibility.title")}>
        <div className="space-y-2">
          {activeMembers.length === 1 && responsible ? (
            <p className="text-sm">
              {t("pagesAppsChatGitHubBotConfiguration.access.responsibility.memberValue", { name: memberName(configuration.responsibleUserId) })}
            </p>
          ) : (
            <>
              <Label>{t("pagesAppsChatGitHubBotConfiguration.access.responsibility.member")}</Label>
              <GitHubSponsorSelect
                label={t("pagesAppsChatGitHubBotConfiguration.access.responsibility.member")}
                companyId={companyId}
                members={activeMembers}
                access={boardAccess.data}
                value={configuration.responsibleUserId}
                onChange={(userId) =>
                  onChange({
                    ...configuration,
                    responsibleUserId: userId,
                  })
                }
              />
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {t("pagesAppsChatGitHubBotConfiguration.access.responsibility.description")}
          </p>
        </div>
      </GitHubSettingsDisclosure>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {(membersView.kind === "error" || linksView.kind === "error" || boardAccessView.kind === "error") && (
        <QueryErrorState
          error={membersView.kind === "error" ? members.error : linksView.kind === "error" ? links.error : boardAccess.error}
          action={t("pagesAppsChatGitHubBotConfiguration.access.loadAction")}
          onRetry={() => {
            membersView.retry();
            linksView.retry();
            boardAccessView.retry();
          }}
          retrying={members.isFetching || links.isFetching || boardAccess.isFetching}
        />
      )}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className={ANALYTICS_MASK_CLASS}>
          <DialogHeader>
            <DialogTitle>
              {dialog === "member"
                ? t("pagesAppsChatGitHubBotConfiguration.dialog.memberTitle")
                : t("pagesAppsChatGitHubBotConfiguration.access.addExternal")}
            </DialogTitle>
            <DialogDescription>
              {dialog === "member"
                ? t("pagesAppsChatGitHubBotConfiguration.dialog.memberDescription")
                : t("pagesAppsChatGitHubBotConfiguration.dialog.guestDescription")}
            </DialogDescription>
          </DialogHeader>
          {dialog === "member" ? (
            <>
              <Button
                variant="outline"
                aria-label={t("pagesAppsChatGitHubBotConfiguration.dialog.copyLinkAriaLabel")}
                onClick={() => {
                  if (accountLink.current)
                    void copyTextToClipboard(accountLink.current.href).then(
                      () => setLinkCopied(true),
                      () =>
                        setError(
                          t("pagesAppsChatGitHubBotConfiguration.dialog.copyFailed"),
                        ),
                    );
                }}
              >
                <Copy className="size-4" />
                {linkCopied ? t("pagesAppsChatGitHubBotConfiguration.dialog.copied") : t("pagesAppsChatGitHubBotConfiguration.dialog.copyInvitation")}
              </Button>
              <Link
                ref={accountLink}
                to={`/apps/chat/connect?provider=github&resume=${endpointId}&stage=identity`}
                className="text-sm underline underline-offset-4"
              >
                {t("pagesAppsChatGitHubBotConfiguration.dialog.linkYourAccount")}
              </Link>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="github-guest-login">{t("pagesAppsChatGitHubBotConfiguration.dialog.githubUsername")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="github-guest-login"
                    value={login}
                    placeholder="octocat"
                    disabled={busy}
                    onChange={(e) => {
                      setLogin(e.target.value);
                      setCandidate(null);
                      setLookupError("");
                    }}
                  />
                  <Button
                    variant="outline"
                    disabled={busy || !login.trim()}
                    onClick={async () => {
                      setBusy(true);
                      setLookupError("");
                      setCandidate(null);
                      try {
                        setCandidate(
                          await githubChatApi.lookup(endpointId, login),
                        );
                      } catch (e) {
                        setLookupError(
                          describeError(e).body,
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? t("pagesAppsChatGitHubBotConfiguration.dialog.lookingUp") : t("pagesAppsChatGitHubBotConfiguration.dialog.lookUp")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("pagesAppsChatGitHubBotConfiguration.dialog.sponsor")}</Label>
                <GitHubSponsorSelect
                  label={t("pagesAppsChatGitHubBotConfiguration.dialog.sponsor")}
                  companyId={companyId}
                  members={activeMembers}
                  access={boardAccess.data}
                  value={guestSponsor}
                  onChange={setSponsor}
                />
              </div>
              {candidate && (
                <p role="status" className={cn("text-sm", ANALYTICS_MASK_CLASS)}>
                  {configuration.people.some(
                    (p) => p.githubUserId === candidate.githubUserId,
                  ) ||
                  linkedAccounts.some(
                    (link) => link.githubUserId === candidate.githubUserId,
                  )
                    ? t("pagesAppsChatGitHubBotConfiguration.dialog.alreadyListed", { login: candidate.login })
                    : t("pagesAppsChatGitHubBotConfiguration.dialog.found", { login: candidate.login })}
                </p>
              )}
              {lookupError && (
                <p role="alert" className="text-sm text-destructive">
                  {lookupError}
                </p>
              )}
              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button variant="ghost" onClick={() => setDialog(null)}>
                  {t("pagesAppsChatGitHubBotConfiguration.dialog.cancel")}
                </Button>
                <Button
                  disabled={
                    !candidate ||
                    !activeMembers.some(
                      (member) => member.principalId === guestSponsor,
                    ) ||
                    configuration.people.some(
                      (p) => p.githubUserId === candidate.githubUserId,
                    ) ||
                    linkedAccounts.some(
                      (link) => link.githubUserId === candidate.githubUserId,
                    )
                  }
                  onClick={() => {
                    if (candidate) {
                      updatePerson({
                        ...candidate,
                        kind: "guest",
                        sponsorUserId: guestSponsor,
                        permissionProfile: "restricted",
                      });
                      setDialog(null);
                      setCandidate(null);
                      setLogin("");
                    }
                  }}
                >
                  {t("pagesAppsChatGitHubBotConfiguration.dialog.addContributor")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
