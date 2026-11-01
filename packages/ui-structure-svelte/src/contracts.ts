/** Host commands are callbacks; the explorer never grants application effects. */
export type WorkspaceCommand = { id?: string; label: string; run: () => void; disabled?: boolean; separator?: boolean };
