import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, FolderOpen } from "lucide-react";
import { Link, Navigate, useCaseHref, useLocation, useParams } from "@/lib/router";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { casesApi, caseAttachmentUrl, isImageAttachment, type CaseSummary } from "@/api/cases";
import { ApiError } from "@/api/client";
import { agentsApi } from "@/api/agents";
import { projectsApi } from "@/api/projects";
import { CaseAttachmentsGallery } from "@/components/CaseAttachmentsGallery";
import { CaseFieldsTable } from "@/components/CaseFieldsPanel";
import { CaseIdentifierKey } from "@/components/CaseIdentifierKey";
import { EmptyState } from "@/components/EmptyState";
import { EntityRow } from "@/components/EntityRow";
import { IssueReferencePill } from "@/components/IssueReferencePill";
import { PageSkeleton } from "@/components/PageSkeleton";
import { QueryErrorState, queryViewKind, useQueryView } from "@/components/QueryView";
import { CaseDocumentPreview } from "@/components/cases/CaseDocumentPreview";
import { CaseHandoffHistory } from "@/components/cases/CaseHandoffHistory";
import { CaseStatus } from "@/components/cases/CaseStatus";
import { CaseWorkSummary } from "@/components/cases/CaseWorkSummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { caseAuditHref } from "./audit/audit-navigation";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

function CaseRelation({ item, search }: { item: Pick<CaseSummary, "id" | "identifier" | "title" | "caseType" | "status">; search: string }) {
  const caseHref = useCaseHref();
  return <EntityRow to={`${caseHref(item.identifier)}${search}`} title={item.title}
    subtitle={<><span className="font-mono">{item.identifier}</span><span> · {item.caseType}</span></>}
    trailing={<CaseStatus status={item.status} />} className="px-0" />;
}

/** Cases are persistent records. This board page only reads them and their work. */
export function CaseDetail() {
  const { caseIdentifier } = useParams<{ caseIdentifier: string }>();
  const { search } = useLocation();
  const caseHref = useCaseHref();
  const { setBreadcrumbs } = useBreadcrumbs();
  const caseQuery = useQuery({
    queryKey: queryKeys.cases.detail(caseIdentifier ?? ""),
    queryFn: () => casesApi.get(caseIdentifier!),
    enabled: !!caseIdentifier,
  });
  const caseView = useQueryView(caseQuery);
  const caseData = caseQuery.data;
  const listPath = `${caseHref()}${search}`;
  const childrenQuery = useQuery({
    queryKey: queryKeys.cases.children(caseData?.id ?? ""),
    queryFn: () => casesApi.listChildren(caseData!.companyId, caseData!.id),
    enabled: !!caseData,
  });
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(caseData?.companyId ?? ""),
    queryFn: () => agentsApi.list(caseData!.companyId),
    enabled: !!caseData?.workIssueId,
  });
  const projectQuery = useQuery({
    queryKey: queryKeys.projects.detail(caseData?.projectId ?? ""),
    queryFn: () => projectsApi.get(caseData!.projectId!, caseData!.companyId),
    enabled: !!caseData?.projectId,
  });
  const agents = useMemo(() => new Map((agentsQuery.data ?? []).map(agent => [agent.id, agent])), [agentsQuery.data]);

  useEffect(() => {
    setBreadcrumbs([{ label: t("pagesCaseDetail.breadcrumbs.cases"), href: listPath }, { label: caseData?.identifier ?? caseIdentifier ?? t("pagesCaseDetail.breadcrumbs.case") }]);
  }, [setBreadcrumbs, listPath, caseData?.identifier, caseIdentifier]);

  if (!caseIdentifier) return <Navigate to={listPath} replace />;
  if (caseQuery.isLoading || caseView.kind === "reconnecting") return <div data-testid="case-pages"><PageSkeleton variant="detail" /></div>;
  if (caseView.kind === "error" || !caseData) {
    // "Not found" only for a real 403/404; an outage never looks like a missing case.
    const unavailable = caseQuery.error instanceof ApiError && [403, 404].includes(caseQuery.error.status);
    return <div data-testid="case-pages" className="space-y-4">
      {unavailable
        ? <EmptyState icon={FolderOpen} message={t("pagesCaseDetail.notFound")} />
        : <QueryErrorState size="page" error={caseQuery.error} action={t("pagesCaseDetail.loadAction")} onRetry={caseView.retry} retrying={caseView.isFetching} />}
      <div className="flex justify-center gap-3">
        <Button variant="link" asChild><Link to={listPath}>{t("pagesCaseDetail.backToCases")}</Link></Button>
      </div>
    </div>;
  }

  // A document is the authoritative version of a field with the same key.
  const documentKeys = new Set(caseData.documents.map(document => document.key.toLowerCase()));
  const taskDocuments = caseData.taskDocuments ?? [];
  const fields = Object.entries(caseData.fields).filter(([key, value]) => !documentKeys.has(key.toLowerCase())
    && !(key.toLowerCase() === "title" && value === caseData.title)
    && !(key.toLowerCase() === "description" && value === caseData.summary));
  const relatedTasks = caseData.issueLinks.filter(link => link.issueId !== caseData.workIssueId);
  const images = caseData.attachments.filter(isImageAttachment);
  const files = caseData.attachments.filter(attachment => !isImageAttachment(attachment));
  const children = childrenQuery.data ?? [];

  return <div className="mx-auto max-w-5xl space-y-8" data-testid="case-pages">
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <CaseIdentifierKey identifier={caseData.identifier} caseKey={caseData.key} />
        <span>{caseData.caseType}</span><CaseStatus status={caseData.status} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{caseData.title}</h1>
      {caseData.summary && <p className={cn("max-w-3xl text-sm leading-relaxed text-muted-foreground", ANALYTICS_MASK_CLASS)}>{caseData.summary}</p>}
      {caseData.labels.length > 0 && <div className="flex flex-wrap gap-1.5" aria-label={t("pagesCaseDetail.labels")}>{caseData.labels.map(label => <Badge key={label.id} variant="secondary" className="font-normal">{label.name}</Badge>)}</div>}
    </header>

    <div className="min-w-0 space-y-8">
      <CaseWorkSummary caseData={caseData} agents={agents} />
      {fields.length > 0 && <section className="space-y-3" aria-label={t("pagesCaseDetail.details.label")}>
        <h2 className="text-sm font-semibold">{t("pagesCaseDetail.details.title")}</h2>
        <CaseFieldsTable fields={Object.fromEntries(fields)} />
      </section>}

      {(caseData.documents.length > 0 || taskDocuments.length > 0) && <section className="space-y-3" aria-label={t("pagesCaseDetail.documents.label")}>
        <h2 className="text-sm font-semibold">{t("pagesCaseDetail.documents.title")}</h2>
        <div className="divide-y divide-border">
          {taskDocuments.map(document => <CaseDocumentPreview key={document.id} caseIdentifier={caseData.identifier} document={document} />)}
          {caseData.documents.map(document => <CaseDocumentPreview key={`case:${caseData.id}:${document.key}`} caseIdentifier={caseData.identifier} document={document} />)}
        </div>
        {caseData.taskDocumentsOmitted && <p className="text-xs text-muted-foreground">{t("pagesCaseDetail.documents.more")}</p>}
      </section>}

      {caseData.attachments.length > 0 && <section className="space-y-3" aria-label={t("pagesCaseDetail.attachments.label")}>
        <h2 className="text-sm font-semibold">{t("pagesCaseDetail.attachments.title")}</h2>
        {images.length > 0 && <CaseAttachmentsGallery attachments={images} />}
        {files.length > 0 && <ul className={cn("space-y-2", ANALYTICS_MASK_CLASS)}>{files.map(attachment => <li key={attachment.id}><a href={caseAttachmentUrl(attachment)} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 text-sm text-primary hover:underline"><FileText aria-hidden className="size-4 shrink-0" /><span className="truncate">{attachment.asset.originalFilename ?? t("pagesCaseDetail.attachments.download")}</span></a></li>)}</ul>}
      </section>}

      {caseData.workIssueId && <CaseHandoffHistory caseId={caseData.id} task={caseData.workIssue} agents={agents} />}

      {relatedTasks.length > 0 && <details className="space-y-3">
        <summary className="w-fit cursor-pointer text-sm font-semibold">{t("pagesCaseDetail.relatedTasks")} <span className="text-muted-foreground">{relatedTasks.length}</span></summary>
        <ul className="space-y-2">{relatedTasks.map(link => <li key={link.id} className="flex flex-wrap items-center gap-2"><IssueReferencePill issue={link.issue} /><span className="text-sm text-muted-foreground">{link.issue.title}</span><span className="text-xs text-muted-foreground">{link.role}</span></li>)}</ul>
      </details>}

      {(caseData.parent || children.length > 0 || childrenQuery.isError) && <details className="space-y-3">
        <summary className="w-fit cursor-pointer text-sm font-semibold">{t("pagesCaseDetail.relatedCases")}</summary>
        {caseData.parent && <div className="space-y-1"><h3 className="text-xs text-muted-foreground">{t("pagesCaseDetail.parent")}</h3><CaseRelation item={caseData.parent} search={search} /></div>}
        {children.length > 0 && <div className="space-y-1"><h3 className="text-xs text-muted-foreground">{t("pagesCaseDetail.children")} {children.length}</h3>{children.map(child => <CaseRelation key={child.id} item={child} search={search} />)}</div>}
        {queryViewKind(childrenQuery) === "error" && <p role="alert" className="text-sm text-destructive">{t("pagesCaseDetail.childrenError")}</p>}
      </details>}

      {!fields.length && !caseData.documents.length && !taskDocuments.length && !caseData.attachments.length && <p className="text-sm text-muted-foreground">{t("pagesCaseDetail.noFindings")}</p>}
      <dl className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
        {projectQuery.data && <div className="space-y-1"><dt>{t("pagesCaseDetail.meta.project")}</dt><dd><Link to={`/projects/${projectQuery.data.id}`} className="text-foreground hover:underline">{projectQuery.data.name}</Link></dd></div>}
        <div className="space-y-1"><dt>{t("pagesCaseDetail.meta.created")}</dt><dd><time dateTime={caseData.createdAt} className="font-mono">{formatDateTime(caseData.createdAt, { includeYear: false })}</time></dd></div>
        <div className="space-y-1"><dt>{t("pagesCaseDetail.meta.updated")}</dt><dd><time dateTime={caseData.updatedAt} className="font-mono">{formatDateTime(caseData.updatedAt, { includeYear: false })}</time></dd></div>
      </dl>
      <Link to={caseAuditHref(caseData.id)} className="inline-block text-sm text-muted-foreground hover:text-foreground hover:underline">{t("pagesCaseDetail.viewInAudit")}</Link>
    </div>
  </div>;
}
