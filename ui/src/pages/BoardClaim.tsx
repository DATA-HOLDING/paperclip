import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "@/lib/router";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { describeError } from "../api/errors";
import { QueryErrorState, useQueryView } from "../components/QueryView";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { t } from "@/i18n";

export function BoardClaimPage() {
  const queryClient = useQueryClient();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const token = (params.token ?? "").trim();
  const code = (searchParams.get("code") ?? "").trim();
  const currentPath = useMemo(
    () => `/board-claim/${encodeURIComponent(token)}${code ? `?code=${encodeURIComponent(code)}` : ""}`,
    [token, code],
  );

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const statusQuery = useQuery({
    queryKey: ["board-claim", token, code],
    queryFn: () => accessApi.getBoardClaimStatus(token, code),
    enabled: token.length > 0 && code.length > 0,
  });
  const statusView = useQueryView(statusQuery);

  const claimMutation = useMutation({
    mutationFn: () => accessApi.claimBoard(token, code),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.health });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.stats });
      await statusQuery.refetch();
    },
  });

  if (!token || !code) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">{t("pagesBoardClaim.invalidUrl")}</div>;
  }

  if (statusQuery.isLoading || sessionQuery.isLoading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">{t("pagesBoardClaim.loading")}</div>;
  }

  if (statusView.kind === "error") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card className="block p-6">
          <QueryErrorState
            size="panel"
            error={statusView.error}
            action={t("pagesBoardClaim.errorActions.loadChallenge")}
            onRetry={statusView.retry}
            retrying={statusView.isFetching}
          />
        </Card>
      </div>
    );
  }

  const status = statusQuery.data;
  if (!status) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">{t("pagesBoardClaim.unavailable")}</div>;
  }

  if (status.status === "claimed") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card className="block p-6">
          <h1 className="text-lg font-semibold">{t("pagesBoardClaim.claimed.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("pagesBoardClaim.claimed.body")}
          </p>
          <Button asChild className="mt-4">
            <Link to="/">{t("pagesBoardClaim.claimed.open")}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (!sessionQuery.data) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card className="block p-6">
          <h1 className="text-lg font-semibold">{t("pagesBoardClaim.signIn.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("pagesBoardClaim.signIn.body")}
          </p>
          <Button asChild className="mt-4">
            <Link to={`/auth?next=${encodeURIComponent(currentPath)}`}>{t("pagesBoardClaim.signIn.action")}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="block p-6">
        <h1 className="text-xl font-semibold">{t("pagesBoardClaim.claim.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("pagesBoardClaim.claim.body")}
        </p>

        {claimMutation.isError && ( // query-error-ok: mutation result
          <p className="mt-3 text-sm text-destructive">{describeError(claimMutation.error).body}</p>
        )}

        <Button
          className="mt-5"
          onClick={() => claimMutation.mutate()}
          disabled={claimMutation.isPending}
        >
          {claimMutation.isPending ? t("pagesBoardClaim.claim.claiming") : t("pagesBoardClaim.claim.action")}
        </Button>
      </Card>
    </div>
  );
}
