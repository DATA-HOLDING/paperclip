import type { BoardBootstrap } from "@paperclipai/shared";
import { t } from "@/i18n";
import { accessApi } from "./access";
import { ApiError, detachInflightGet } from "./client";
import { queryKeys } from "../lib/queryKeys";

export function boardAccessQueryOptions(
  userId: string | null,
  bootstrap: BoardBootstrap | undefined,
  updatedAt: number,
  onAccountChanged: () => void,
) {
  const initialData = userId && bootstrap?.userId === userId && bootstrap.boardAccess.userId === userId
    ? bootstrap.boardAccess
    : undefined;
  return {
    queryKey: [...queryKeys.access.currentBoardAccess, userId] as const,
    initialData,
    initialDataUpdatedAt: initialData ? updatedAt : undefined,
    queryFn: async (): Promise<BoardBootstrap["boardAccess"]> => {
      // Path-only request coalescing must not join reads from two accounts.
      detachInflightGet("/cli-auth/me");
      const access = await accessApi.getCurrentBoardAccess();
      if (access.userId !== userId) {
        onAccountChanged();
        throw new ApiError(t("apiBoardAccessQuery.sessionChanged"), 401, { code: "session_changed" });
      }
      return { userId: access.userId, isInstanceAdmin: access.isInstanceAdmin, companyIds: access.companyIds };
    },
  };
}
