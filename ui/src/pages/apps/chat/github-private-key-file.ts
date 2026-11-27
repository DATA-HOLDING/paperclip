import { t } from "@/i18n";
export const GITHUB_PRIVATE_KEY_FILE_MAX_BYTES = 64 * 1024;

export function createGitHubPrivateKeyReadGuard() {
  let revision = 0;
  return {
    start() {
      revision += 1;
      return revision;
    },
    invalidate() {
      revision += 1;
    },
    isCurrent(candidate: number) {
      return candidate === revision;
    },
  };
}

export async function readGitHubPrivateKeyFile(
  file: Pick<File, "size" | "text">,
): Promise<string> {
  if (file.size === 0) {
    throw new Error(
      t("pagesAppsChatGithubPrivateKeyFile.empty"),
    );
  }
  if (file.size > GITHUB_PRIVATE_KEY_FILE_MAX_BYTES) {
    throw new Error(
      t("pagesAppsChatGithubPrivateKeyFile.tooLarge"),
    );
  }

  let value: string;
  try {
    value = await file.text();
  } catch {
    throw new Error(
      t("pagesAppsChatGithubPrivateKeyFile.readFailed"),
    );
  }
  if (!value.trim()) {
    throw new Error(
      t("pagesAppsChatGithubPrivateKeyFile.empty"),
    );
  }
  return value;
}
