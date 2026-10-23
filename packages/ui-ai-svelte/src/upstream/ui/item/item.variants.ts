import { tv, type VariantProps } from 'tailwind-variants';

export const itemVariants = tv({
  base: '[a]:hover:bg-muted rounded-2xl border text-sm group/item flex w-full flex-wrap items-center transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors',
  variants: {
    variant: {
      default: 'border-transparent',
      outline: 'border-border',
      muted: 'bg-muted/50 border-transparent',
    },
    size: {
      default: 'gap-3.5 px-4 py-3.5',
      sm: 'gap-3.5 px-3.5 py-3',
      xs: 'gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export type ItemSize = VariantProps<typeof itemVariants>['size'];
export type ItemVariant = VariantProps<typeof itemVariants>['variant'];
