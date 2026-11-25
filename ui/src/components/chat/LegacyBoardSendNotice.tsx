import { t } from "@/i18n";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function LegacyBoardSendNotice({ onDiscard }: { onDiscard: () => void }) {
  return <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button size="sm" variant="outline">{t("componentsChat.legacyBoardSendNotice.trigger")}</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("componentsChat.legacyBoardSendNotice.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("componentsChat.legacyBoardSendNotice.description")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("componentsChat.legacyBoardSendNotice.keep")}</AlertDialogCancel>
        <AlertDialogAction onClick={onDiscard}>{t("componentsChat.legacyBoardSendNotice.discard")}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
