/** The controlled Menubar value also owns each menu portal lifetime. */
export const B4_MENUBAR_VALUE = Symbol('vict.catalog.menubar.value');
export type B4MenubarValue = () => string;

/** Controlled catalog values; shared owned-menu.ts remains the keyboard/layer authority. */
export const B4_OWNED_RADIO = Symbol('vict.catalog.owned-menu.radio');
export interface B4OwnedRadio {
  value: () => string;
  select: (value: string) => void;
}
export const B4_OWNED_CHECKBOX = Symbol('vict.catalog.owned-menu.checkbox');
export interface B4OwnedCheckbox {
  values: () => readonly string[];
  toggle: (value: string, checked?: boolean) => void;
}
export const B4_OWNED_MENUBAR = Symbol('vict.catalog.owned-menubar');
export interface B4OwnedMenubar {
  value: () => string;
  select: (value: string) => void;
  navigate: (trigger: HTMLElement, direction: 'next' | 'previous' | 'first' | 'last', open: boolean) => void;
}
