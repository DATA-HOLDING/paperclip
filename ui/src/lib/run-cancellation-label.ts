import { t } from "@/i18n";

export function runCancellationLabel(input: { grokWork?: boolean; isFailed: boolean; isPending: boolean }): string {
  if (input.grokWork) return input.isPending ? t("libRunCancellationLabel.stoppingPaperclipWork") : t("libRunCancellationLabel.stopPaperclipWork");
  if (input.isFailed) return input.isPending ? t("libRunCancellationLabel.stopping") : t("libRunCancellationLabel.stop");
  return input.isPending ? t("libRunCancellationLabel.cancelling") : t("libRunCancellationLabel.cancel");
}
