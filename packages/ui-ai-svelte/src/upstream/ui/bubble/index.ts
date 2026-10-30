import Content from './bubble-content.svelte';
import Group from './bubble-group.svelte';
import Reactions from './bubble-reactions.svelte';
import {
  bubbleReactionsVariants,
  type BubbleReactionsAlign,
  type BubbleReactionsSide,
} from './bubble-reactions.variants.js';
import Root from './bubble.svelte';
import { bubbleVariants, type BubbleVariant } from './bubble.variants.js';

export {
  Root,
  Group,
  Content,
  Reactions,
  bubbleVariants,
  bubbleReactionsVariants,
  type BubbleVariant,
  type BubbleReactionsSide,
  type BubbleReactionsAlign,
  //
  Root as Bubble,
  Group as BubbleGroup,
  Content as BubbleContent,
  Reactions as BubbleReactions,
};
