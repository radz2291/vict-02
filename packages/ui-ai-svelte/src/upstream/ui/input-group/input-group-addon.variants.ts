import { tv, type VariantProps } from 'tailwind-variants';
export const inputGroupAddonVariants = tv({
  base: "text-muted-foreground **:data-[slot=kbd]:bg-muted-foreground/10 h-auto gap-2 py-1.5 text-sm font-medium group-data-[disabled=true]/input-group:opacity-50 **:data-[slot=kbd]:rounded-2xl **:data-[slot=kbd]:px-1.5 [&>svg:not([class*='size-'])]:size-4 flex cursor-text items-center justify-center select-none",
  variants: {
    align: {
      'inline-start': 'pl-2 has-[>button]:ml-[-0.3rem] has-[>kbd]:ml-[-0.15rem] order-first',
      'inline-end': 'pr-2 has-[>button]:mr-[-0.3rem] has-[>kbd]:mr-[-0.15rem] order-last',
      'block-start':
        'px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2 order-first w-full justify-start',
      'block-end':
        'px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2 order-last w-full justify-start',
    },
  },
  defaultVariants: {
    align: 'inline-start',
  },
});

export type InputGroupAddonAlign = VariantProps<typeof inputGroupAddonVariants>['align'];
