import { useContext } from "react";
import { QueryClient, QueryClientContext, useQuery } from "@tanstack/react-query";
import { useAccountBoundMutation } from "./useAccountBoundMutation";
import { useResolvedViewerId } from "./useResolvedViewerId";
import { workspacePreferencesApi } from "@/api/workspacePreferences";
import { queryKeys } from "@/lib/queryKeys";
import { t } from "@/i18n";

let detachedClient: QueryClient | null = null;
const getDetachedClient = () => detachedClient ??= new QueryClient();

export function useCoordinatorWorkspaceEnabled() {
  const contextClient = useContext(QueryClientContext);
  const client = contextClient ?? getDetachedClient();
  const viewer = useResolvedViewerId({ client, enabled: contextClient != null });
  const { userId } = viewer;
  const preference = useQuery({
    queryKey: queryKeys.workspacePreferences.mine(userId),
    queryFn: () => workspacePreferencesApi.get(),
    enabled: contextClient != null && !!userId,
  }, client);
  const mutation = useAccountBoundMutation({
    mutationFn: async ({ companyId, enabled, owner }: { companyId: string; enabled: boolean; owner: string }) => {
      const result = await workspacePreferencesApi.update(companyId, { coordinatorWorkspaceEnabled: enabled });
      if (result.userId !== owner) throw new Error(t("hooksUseCoordinatorWorkspaceEnabled.accountChanged"));
      return result;
    },
    onSuccess: (result) => {
      // Only a response in its original verified account may update the cache.
      client.setQueryData(queryKeys.workspacePreferences.mine(result.userId), result);
    },
  }, client);
  const classicWorkspaceEnabled = !!userId && preference.isSuccess
    && preference.data.userId === userId && preference.data.coordinatorWorkspaceEnabled === false;
  return {
    enabled: !!contextClient && !classicWorkspaceEnabled,
    loaded: !contextClient || (viewer.loaded && (!userId || preference.isFetched)),
    userId,
    error: viewer.error ?? preference.error
      ?? (mutation.variables?.owner === userId ? mutation.error : null),
    isSaving: mutation.isPending && mutation.variables?.owner === userId,
    setEnabled: async (companyId: string, enabled: boolean) => {
      if (!contextClient || !userId) throw new Error(t("hooksUseCoordinatorWorkspaceEnabled.signInFirst"));
      return mutation.mutateAsync({ companyId, enabled, owner: userId });
    },
    retry: async () => {
      mutation.reset();
      if (viewer.error) return viewer.retry();
      if (userId) return preference.refetch();
    },
  };
}
