import { tv, type VariantProps } from 'tailwind-variants';

export const itemMediaVariants = tv({
  base: 'gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start flex shrink-0 items-center justify-center [&_svg]:pointer-events-none',
  variants: {
    variant: {
      default: 'bg-transparent',
      icon: "[&_svg:not([class*='size-'])]:size-4",
      image:
        'size-10 overflow-hidden rounded-xl group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 group-data-[size=xs]/item:rounded-lg [&_img]:size-full [&_img]:object-cover',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type ItemMediaVariant = VariantProps<typeof itemMediaVariants>['variant'];
