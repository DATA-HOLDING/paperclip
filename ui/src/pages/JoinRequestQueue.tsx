import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus2 } from "lucide-react";
import { accessApi } from "@/api/access";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { t } from "@/i18n";

export function JoinRequestQueue() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"pending_approval" | "approved" | "rejected">("pending_approval");
  const [requestType, setRequestType] = useState<"all" | "human" | "agent">("all");

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? t("pagesJoinRequestQueue.breadcrumbs.organization"), href: "/dashboard" },
      { label: t("pagesJoinRequestQueue.breadcrumbs.inbox"), href: "/inbox" },
      { label: t("pagesJoinRequestQueue.breadcrumbs.joinRequests") },
    ]);
  }, [selectedCompany?.name, setBreadcrumbs]);

  const requestsQuery = useQuery({
    queryKey: queryKeys.access.joinRequests(selectedCompanyId ?? "", `${status}:${requestType}`),
    queryFn: () =>
      accessApi.listJoinRequests(
        selectedCompanyId!,
        status,
        requestType === "all" ? undefined : requestType,
      ),
    enabled: !!selectedCompanyId,
  });
  const requestsView = useQueryView(requestsQuery);

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => accessApi.approveJoinRequest(selectedCompanyId!, requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.joinRequests(selectedCompanyId!, `${status}:${requestType}`) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.companyMembers(selectedCompanyId!) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.companyUserDirectory(selectedCompanyId!) });
      pushToast({ title: t("pagesJoinRequestQueue.toast.approved"), tone: "success" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => accessApi.rejectJoinRequest(selectedCompanyId!, requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.joinRequests(selectedCompanyId!, `${status}:${requestType}`) });
      pushToast({ title: t("pagesJoinRequestQueue.toast.rejected"), tone: "success" });
    },
  });

  if (!selectedCompanyId) {
    return <div className="text-sm text-muted-foreground">{t("pagesJoinRequestQueue.selectOrganization")}</div>;
  }

  if (requestsQuery.isLoading || requestsView.kind === "reconnecting") {
    return <div className="text-sm text-muted-foreground">{t("pagesJoinRequestQueue.loading")}</div>;
  }

  if (requestsView.kind === "error") {
    if (requestsView.errorKind === "forbidden") {
      return (
        <div className="text-sm text-destructive">
          {t("pagesJoinRequestQueue.forbidden")}
        </div>
      );
    }
    return (
      <QueryErrorState
        size="page"
        error={requestsQuery.error}
        action={t("pagesJoinRequestQueue.loadAction")}
        onRetry={requestsView.retry}
        retrying={requestsView.isFetching}
      />
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("pagesJoinRequestQueue.title")}</h1>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t("pagesJoinRequestQueue.description")}
        </p>
      </div>

      <Card className="flex-row flex-wrap gap-3 p-4">
        <label className="space-y-2 text-sm">
          <span className="font-medium">{t("pagesJoinRequestQueue.filters.status")}</span>
          <select
            className="rounded-md border border-border bg-background px-3 py-2"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "pending_approval" | "approved" | "rejected")
            }
          >
            <option value="pending_approval">{t("pagesJoinRequestQueue.filters.pendingApproval")}</option>
            <option value="approved">{t("pagesJoinRequestQueue.filters.approved")}</option>
            <option value="rejected">{t("pagesJoinRequestQueue.filters.rejected")}</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">{t("pagesJoinRequestQueue.filters.requestType")}</span>
          <select
            className="rounded-md border border-border bg-background px-3 py-2"
            value={requestType}
            onChange={(event) =>
              setRequestType(event.target.value as "all" | "human" | "agent")
            }
          >
            <option value="all">{t("pagesJoinRequestQueue.filters.all")}</option>
            <option value="human">{t("pagesJoinRequestQueue.filters.human")}</option>
            <option value="agent">{t("pagesJoinRequestQueue.filters.agent")}</option>
          </select>
        </label>
      </Card>

      <div className="space-y-4">
        {(requestsQuery.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            {t("pagesJoinRequestQueue.empty")}
          </div>
        ) : (
          requestsQuery.data!.map((request) => (
            <Card key={request.id} className="block p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={request.status === "pending_approval" ? "secondary" : request.status === "approved" ? "outline" : "destructive"}>
                      {request.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline">{request.requestType}</Badge>
                    {request.adapterType ? <Badge variant="outline">{request.adapterType}</Badge> : null}
                  </div>
                  <div>
                    <div className="text-base font-medium">
                      {request.requestType === "human"
                        ? request.requesterUser?.name || request.requestEmailSnapshot || request.requestingUserId || t("pagesJoinRequestQueue.unknownHuman")
                        : request.agentName || t("pagesJoinRequestQueue.unknownAgent")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {request.requestType === "human"
                        ? request.requesterUser?.email || request.requestEmailSnapshot || request.requestingUserId
                        : request.capabilities || request.requestIp}
                    </div>
                  </div>
                </div>

                {request.status === "pending_approval" ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => rejectMutation.mutate(request.id)}
                      disabled={rejectMutation.isPending}
                    >
                      {t("pagesJoinRequestQueue.reject")}
                    </Button>
                    <Button
                      onClick={() => approveMutation.mutate(request.id)}
                      disabled={approveMutation.isPending}
                    >
                      {t("pagesJoinRequestQueue.approve")}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-xs font-medium uppercase tracking-wide">{t("pagesJoinRequestQueue.inviteContext")}</div>
                  <div className="mt-2">
                    {request.invite
                      ? `${t("pagesJoinRequestQueue.inviteSummary", { types: request.invite.allowedJoinTypes })}${request.invite.humanRole ? t("pagesJoinRequestQueue.defaultRole", { role: request.invite.humanRole }) : ""}`
                      : t("pagesJoinRequestQueue.inviteUnavailable")}
                  </div>
                  {request.invite?.inviteMessage ? (
                    <div className="mt-2 text-foreground">{request.invite.inviteMessage}</div>
                  ) : null}
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-xs font-medium uppercase tracking-wide">{t("pagesJoinRequestQueue.requestDetails")}</div>
                  <div className="mt-2">{t("pagesJoinRequestQueue.submitted", { date: new Date(request.createdAt).toLocaleString() })}</div>
                  <div>{t("pagesJoinRequestQueue.sourceIp", { ip: request.requestIp })}</div>
                  {request.requestType === "agent" && request.capabilities ? <div>{request.capabilities}</div> : null}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
