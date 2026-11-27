import { t } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ShortcutEntry {
  keys: string[];
  label: string;
  /** Render keys as a simultaneous chord (joined with "+") rather than a
   *  "then" sequence. */
  combo?: boolean;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

const sections: ShortcutSection[] = [
  {
    title: t("componentsKeyboardShortcutsCheatsheet.sections.inbox"),
    shortcuts: [
      { keys: ["j"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.moveDown") },
      { keys: ["↓"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.moveDown") },
      { keys: ["k"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.moveUp") },
      { keys: ["↑"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.moveUp") },
      { keys: ["←"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.collapseGroup") },
      { keys: ["→"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.expandGroup") },
      { keys: ["Enter"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.openItem") },
      { keys: ["a"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.archiveItem") },
      { keys: ["y"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.archiveItem") },
      { keys: ["r"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.markRead") },
      { keys: ["U"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.markUnread") },
    ],
  },
  {
    title: t("componentsKeyboardShortcutsCheatsheet.sections.taskDetail"),
    shortcuts: [
      { keys: ["y"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.quickArchive") },
      { keys: ["g", "i"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.goToInbox") },
      { keys: ["g", "c"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.focusComposer") },
    ],
  },
  {
    title: t("componentsKeyboardShortcutsCheatsheet.sections.decisions"),
    shortcuts: [
      { keys: ["j"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.moveDown") },
      { keys: ["↓"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.moveDown") },
      { keys: ["k"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.moveUp") },
      { keys: ["↑"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.moveUp") },
      { keys: ["Enter"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.toggleDecision") },
      { keys: ["x"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.dismissDecision") },
    ],
  },
  {
    title: t("componentsKeyboardShortcutsCheatsheet.sections.global"),
    shortcuts: [
      { keys: ["/"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.search") },
      { keys: ["c"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.newTask") },
      { keys: ["["], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.toggleSidebar") },
      { keys: ["]"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.togglePanel") },
      { keys: ["?"], label: t("componentsKeyboardShortcutsCheatsheet.shortcuts.showShortcuts") },
    ],
  },
];

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-(--shadow-extract-10)">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsCheatsheetContent() {
  return (
    <>
      <div className="divide-y divide-border border-t border-border">
        {sections.map((section) => (
          <div key={section.title} className="px-5 py-3">
            <h3 className="mb-2 text-(length:--text-micro) font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            <div className="space-y-1.5">
              {section.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.label + shortcut.keys.join()}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-foreground/90">{shortcut.label}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={key} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {shortcut.combo ? "+" : t("componentsKeyboardShortcutsCheatsheet.then")}
                          </span>
                        )}
                        <KeyCap>{key}</KeyCap>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {t("componentsKeyboardShortcutsCheatsheet.footer.press")} <KeyCap>Esc</KeyCap> {t("componentsKeyboardShortcutsCheatsheet.footer.close")}
        </p>
      </div>
    </>
  );
}

export function KeyboardShortcutsCheatsheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">{t("componentsKeyboardShortcutsCheatsheet.title")}</DialogTitle>
        </DialogHeader>
        <KeyboardShortcutsCheatsheetContent />
      </DialogContent>
    </Dialog>
  );
}
