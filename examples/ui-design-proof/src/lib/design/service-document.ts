/**
 * The contrasting service/editorial page (PROOF-DESIGN §3.2), authored as a
 * canonical `vict.ui-document@1`. Fictional business: "Northwind Atelier" —
 * design-lead home renovations. The page demonstrates hero, overlapping
 * card, CSS grid region, sticky section, reusable cards (shared definition
 * + one intentional instance override), responsive typography, tokens,
 * pseudo/hover states, media + container conditions, and an accessible
 * keyboard-operable form whose validation is REAL adapter state.
 */
import type { UiDocument } from '@victframework/ui';

export const SERVICE_STORE_KEY = 'vict.u2.service.doc';
export const DESIGN_STORE_FORMAT = 'vict.design-store@1';
export const SERVICE_SEED_REVISION = '1';

export const serviceDocument: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'doc.northwind',
  revision: '1',
  root: 'svc.root',
  assets: {},
  localState: {},
  tokens: {
    'color.accent': { id: 'color.accent', value: '#1f6f54' },
    'color.accent-soft': { id: 'color.accent-soft', value: '#e7f2ec' },
    'color.ink': { id: 'color.ink', value: '#1c2a24' },
    'color.muted': { id: 'color.muted', value: '#5c6b63' },
    'color.paper': { id: 'color.paper', value: '#faf7f2' },
    'color.card': { id: 'color.card', value: '#ffffff' },
    'color.line': { id: 'color.line', value: '#d9d2c5' },
    'space.xs': { id: 'space.xs', value: '4px' },
    'space.sm': { id: 'space.sm', value: '8px' },
    'space.md': { id: 'space.md', value: '16px' },
    'space.lg': { id: 'space.lg', value: '32px' },
    'radius.md': { id: 'radius.md', value: '10px' },
  },
  conditions: {
    'cond.narrow': { id: 'cond.narrow', kind: 'media', query: '(max-width: 700px)' },
    'cond.page': {
      id: 'cond.page',
      kind: 'container',
      name: 'page-frame',
      query: '(min-width: 720px)',
    },
  },
  styleSources: {
    'src.page-base': {
      id: 'src.page-base',
      declarations: [
        { property: 'margin', value: { type: 'text', value: '0 auto' } },
        { property: 'max-width', value: { type: 'text', value: '1080px' } },
        { property: 'padding', value: { type: 'text', value: '0 clamp(16px, 4vw, 40px) 96px' } },
        { property: 'color', value: { type: 'token', id: 'color.ink' } },
        {
          property: 'font-family',
          value: { type: 'text', value: 'Georgia, "Times New Roman", serif' },
        },
        { property: 'line-height', value: { type: 'text', value: '1.6' } },
      ],
    },
    'src.hero-base': {
      id: 'src.hero-base',
      declarations: [
        { property: 'padding', value: { type: 'text', value: '72px 0 24px' } },
        { property: 'position', value: { type: 'text', value: 'relative' } },
      ],
    },
    'src.hero-title': {
      id: 'src.hero-title',
      declarations: [
        { property: 'font-size', value: { type: 'text', value: 'clamp(34px, 5vw, 56px)' } },
        { property: 'margin', value: { type: 'text', value: '0 0 12px' } },
        { property: 'line-height', value: { type: 'text', value: '1.1' } },
        { property: 'letter-spacing', value: { type: 'text', value: '-0.5px' } },
      ],
    },
    'src.hero-title-narrow': {
      id: 'src.hero-title-narrow',
      declarations: [
        { property: 'font-size', value: { type: 'text', value: '30px' } },
        { property: 'letter-spacing', value: { type: 'text', value: '0' } },
      ],
      conditionId: 'cond.narrow',
    },
    'src.hero-tag': {
      id: 'src.hero-tag',
      declarations: [
        { property: 'font-size', value: { type: 'text', value: '19px' } },
        { property: 'color', value: { type: 'token', id: 'color.muted' } },
        { property: 'max-width', value: { type: 'text', value: '56ch' } },
      ],
    },
    'src.overlap-wrap': {
      id: 'src.overlap-wrap',
      declarations: [
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'justify-content', value: { type: 'text', value: 'flex-end' } },
      ],
    },
    'src.services-head': {
      id: 'src.services-head',
      declarations: [
        { property: 'font-size', value: { type: 'text', value: '30px' } },
        { property: 'margin', value: { type: 'text', value: '56px 0 8px' } },
      ],
    },
    'src.grid': {
      id: 'src.grid',
      declarations: [
        { property: 'display', value: { type: 'text', value: 'grid' } },
        {
          property: 'grid-template-columns',
          value: { type: 'text', value: 'repeat(3, minmax(0, 1fr))' },
        },
        { property: 'gap', value: { type: 'token', id: 'space.md' } },
      ],
      conditionId: 'cond.page',
    },
    'src.story-cols': {
      id: 'src.story-cols',
      declarations: [
        { property: 'display', value: { type: 'text', value: 'grid' } },
        {
          property: 'grid-template-columns',
          value: { type: 'text', value: 'minmax(0, 1.6fr) minmax(240px, 1fr)' },
        },
        { property: 'gap', value: { type: 'token', id: 'space.lg' } },
        { property: 'margin-top', value: { type: 'text', value: '56px' } },
      ],
      conditionId: 'cond.page',
    },
    'src.story-copy': {
      id: 'src.story-copy',
      declarations: [
        { property: 'font-size', value: { type: 'text', value: '17px' } },
        { property: 'max-width', value: { type: 'text', value: '62ch' } },
      ],
    },
    'src.sticky-aside': {
      id: 'src.sticky-aside',
      declarations: [
        { property: 'position', value: { type: 'text', value: 'sticky' } },
        { property: 'top', value: { type: 'text', value: '16px' } },
        { property: 'align-self', value: { type: 'text', value: 'start' } },
      ],
      conditionId: 'cond.page',
    },
    'src.contact-block': {
      id: 'src.contact-block',
      declarations: [
        { property: 'margin-top', value: { type: 'text', value: '64px' } },
        { property: 'padding', value: { type: 'token', id: 'space.lg' } },
        {
          property: 'border',
          value: { type: 'text', value: '1px solid var(--ui-token-color_line)' },
        },
        { property: 'border-radius', value: { type: 'token', id: 'radius.md' } },
        { property: 'background', value: { type: 'token', id: 'color.card' } },
      ],
    },
    'src.field-base': {
      id: 'src.field-base',
      declarations: [
        { property: 'display', value: { type: 'text', value: 'block' } },
        { property: 'width', value: { type: 'text', value: '100%' } },
        { property: 'max-width', value: { type: 'text', value: '420px' } },
        { property: 'padding', value: { type: 'text', value: '10px 12px' } },
        { property: 'margin', value: { type: 'text', value: '4px 0 14px' } },
        {
          property: 'border',
          value: { type: 'text', value: '1px solid var(--ui-token-color_line)' },
        },
        { property: 'border-radius', value: { type: 'text', value: '6px' } },
        { property: 'font', value: { type: 'text', value: 'inherit' } },
      ],
    },
    'src.field-focus': {
      id: 'src.field-focus',
      declarations: [
        {
          property: 'outline',
          value: { type: 'text', value: '2px solid var(--ui-token-color_accent)' },
        },
        { property: 'outline-offset', value: { type: 'text', value: '1px' } },
      ],
      pseudo: 'focus',
    },
    'src.submit-base': {
      id: 'src.submit-base',
      declarations: [
        { property: 'background', value: { type: 'token', id: 'color.accent' } },
        { property: 'color', value: { type: 'text', value: '#ffffff' } },
        { property: 'border', value: { type: 'text', value: 'none' } },
        { property: 'border-radius', value: { type: 'text', value: '6px' } },
        { property: 'padding', value: { type: 'text', value: '10px 20px' } },
        { property: 'font', value: { type: 'text', value: 'inherit' } },
        { property: 'cursor', value: { type: 'text', value: 'pointer' } },
      ],
    },
    'src.submit-hover': {
      id: 'src.submit-hover',
      declarations: [{ property: 'filter', value: { type: 'text', value: 'brightness(1.08)' } }],
      pseudo: 'hover',
    },
    'src.label-base': {
      id: 'src.label-base',
      declarations: [
        { property: 'display', value: { type: 'text', value: 'block' } },
        { property: 'font-weight', value: { type: 'text', value: 'bold' } },
        { property: 'margin-top', value: { type: 'text', value: '10px' } },
      ],
    },
    // Card definition sources (shared across every instance).
    'src.card-base': {
      id: 'src.card-base',
      declarations: [
        { property: 'background', value: { type: 'token', id: 'color.card' } },
        {
          property: 'border',
          value: { type: 'text', value: '1px solid var(--ui-token-color_line)' },
        },
        { property: 'border-radius', value: { type: 'token', id: 'radius.md' } },
        { property: 'padding', value: { type: 'token', id: 'space.md' } },
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'flex-direction', value: { type: 'text', value: 'column' } },
        { property: 'gap', value: { type: 'text', value: '8px' } },
      ],
    },
    'src.card-hover': {
      id: 'src.card-hover',
      declarations: [
        { property: 'border-color', value: { type: 'token', id: 'color.accent' } },
        { property: 'transform', value: { type: 'text', value: 'translateY(-1px)' } },
      ],
      pseudo: 'hover',
    },
    'src.card-title': {
      id: 'src.card-title',
      declarations: [
        { property: 'margin', value: { type: 'text', value: '0' } },
        { property: 'font-size', value: { type: 'text', value: '19px' } },
      ],
    },
    'src.card-body': {
      id: 'src.card-body',
      declarations: [
        { property: 'color', value: { type: 'token', id: 'color.muted' } },
        { property: 'font-size', value: { type: 'text', value: '15px' } },
      ],
    },
    'src.overlap-card': {
      id: 'src.overlap-card',
      declarations: [
        { property: 'margin-top', value: { type: 'text', value: '-56px' } },
        { property: 'width', value: { type: 'text', value: 'min(420px, 92%)' } },
        {
          property: 'box-shadow',
          value: { type: 'text', value: '0 10px 28px rgba(28, 42, 36, 0.16)' },
        },
      ],
    },
    'src.overlap-card-narrow': {
      id: 'src.overlap-card-narrow',
      declarations: [{ property: 'margin-top', value: { type: 'text', value: '16px' } }],
      conditionId: 'cond.narrow',
    },
    'src.accent-override': {
      id: 'src.accent-override',
      declarations: [
        {
          property: 'border-left',
          value: { type: 'text', value: '4px solid var(--ui-token-color_accent)' },
        },
        { property: 'background', value: { type: 'token', id: 'color.accent-soft' } },
      ],
    },
  },
  componentDefinitions: {
    'def.serviceCard': {
      id: 'def.serviceCard',
      revision: '1',
      root: 'svc.card',
      props: [],
      slots: { title: { required: true }, body: {} },
    },
  },
  nodes: {
    // Shared card definition body (stored once; instantiated four times).
    'svc.card': {
      kind: 'element',
      id: 'svc.card',
      tag: 'article',
      styleSources: ['src.card-base', 'src.card-hover'],
      children: ['svc.cardHeading', 'svc.cardBodyWrap'],
    },
    'svc.cardHeading': {
      kind: 'element',
      id: 'svc.cardHeading',
      tag: 'h3',
      styleSources: ['src.card-title'],
      children: ['svc.cardTitleSlot'],
    },
    'svc.cardTitleSlot': {
      kind: 'slot',
      id: 'svc.cardTitleSlot',
      name: 'title',
      required: true,
    },
    'svc.cardBodyWrap': {
      kind: 'element',
      id: 'svc.cardBodyWrap',
      tag: 'div',
      styleSources: ['src.card-body'],
      children: ['svc.cardBodySlot'],
    },
    'svc.cardBodySlot': {
      kind: 'slot',
      id: 'svc.cardBodySlot',
      name: 'body',
      fallback: ['svc.cardBodyFallback'],
    },
    'svc.cardBodyFallback': {
      kind: 'text',
      id: 'svc.cardBodyFallback',
      content: { type: 'literal', value: 'Talk to us about this during a survey.' },
    },
    'svc.root': {
      kind: 'element',
      id: 'svc.root',
      tag: 'main',
      attributes: { 'data-page': 'northwind-home' },
      styleSources: ['src.page-base'],
      localStyle: [
        // The page IS the container frame: container-conditioned rules
        // (services grid, story columns, sticky aside) respond to the page
        // frame — including the workbench's 480-container preview size.
        { property: 'container-type', value: { type: 'text', value: 'inline-size' } },
        { property: 'container-name', value: { type: 'text', value: 'page-frame' } },
      ],
      children: ['svc.hero', 'svc.overlapWrap', 'svc.services', 'svc.story', 'svc.contact'],
    },
    'svc.hero': {
      kind: 'element',
      id: 'svc.hero',
      tag: 'header',
      styleSources: ['src.hero-base'],
      children: ['svc.heroTitle', 'svc.heroTag'],
    },
    'svc.heroTitle': {
      kind: 'element',
      id: 'svc.heroTitle',
      tag: 'h1',
      styleSources: ['src.hero-title', 'src.hero-title-narrow'],
      children: ['svc.heroTitleText'],
    },
    'svc.heroTitleText': {
      kind: 'text',
      id: 'svc.heroTitleText',
      content: { type: 'literal', value: 'Northwind Atelier' },
    },
    'svc.heroTag': {
      kind: 'element',
      id: 'svc.heroTag',
      tag: 'p',
      styleSources: ['src.hero-tag'],
      children: ['svc.heroTagText'],
    },
    'svc.heroTagText': {
      kind: 'text',
      id: 'svc.heroTagText',
      content: {
        type: 'literal',
        value:
          'Design-lead renovations for calm, durable homes — measured twice, built once, documented throughout.',
      },
    },
    'svc.overlapWrap': {
      kind: 'element',
      id: 'svc.overlapWrap',
      tag: 'div',
      styleSources: ['src.overlap-wrap'],
      children: ['svc.overlapCard'],
    },
    'svc.overlapCard': {
      kind: 'component',
      id: 'svc.overlapCard',
      definitionId: 'def.serviceCard',
      styleSources: ['src.overlap-card', 'src.overlap-card-narrow'],
      slots: {
        title: { name: 'title', children: ['svc.overlapCardTitle'] },
        body: { name: 'body', children: ['svc.overlapCardBody'] },
      },
    },
    'svc.overlapCardTitle': {
      kind: 'text',
      id: 'svc.overlapCardTitle',
      content: { type: 'literal', value: 'Spring survey week — two slots left' },
    },
    'svc.overlapCardBody': {
      kind: 'text',
      id: 'svc.overlapCardBody',
      content: {
        type: 'literal',
        value:
          'Book a 90-minute atelier survey. You leave with a measured scope, a candid budget range, and a written condition report.',
      },
    },
    'svc.services': {
      kind: 'element',
      id: 'svc.services',
      tag: 'section',
      attributes: { 'aria-labelledby': 'svc.servicesHeading' },
      children: ['svc.servicesHeading', 'svc.cardsGrid'],
    },
    'svc.servicesHeading': {
      kind: 'element',
      id: 'svc.servicesHeading',
      tag: 'h2',
      styleSources: ['src.services-head'],
      children: ['svc.servicesHeadingText'],
    },
    'svc.servicesHeadingText': {
      kind: 'text',
      id: 'svc.servicesHeadingText',
      content: { type: 'literal', value: 'What we do' },
    },
    'svc.cardsGrid': {
      kind: 'element',
      id: 'svc.cardsGrid',
      tag: 'div',
      styleSources: ['src.grid'],
      children: ['svc.cardKitchens', 'svc.cardBathrooms', 'svc.cardAdaptations'],
    },
    'svc.cardKitchens': {
      kind: 'component',
      id: 'svc.cardKitchens',
      definitionId: 'def.serviceCard',
      slots: {
        title: { name: 'title', children: ['svc.cardKitchensTitle'] },
        body: { name: 'body', children: ['svc.cardKitchensBody'] },
      },
    },
    'svc.cardKitchensTitle': {
      kind: 'text',
      id: 'svc.cardKitchensTitle',
      content: { type: 'literal', value: 'Kitchens' },
    },
    'svc.cardKitchensBody': {
      kind: 'text',
      id: 'svc.cardKitchensBody',
      content: {
        type: 'literal',
        value:
          'Rebuilt for how you actually cook: honest storage, quiet hardware, surfaces that survive a decade of Sundays.',
      },
    },
    'svc.cardBathrooms': {
      kind: 'component',
      id: 'svc.cardBathrooms',
      definitionId: 'def.serviceCard',
      slots: {
        title: { name: 'title', children: ['svc.cardBathroomsTitle'] },
        body: { name: 'body', children: ['svc.cardBathroomsBody'] },
      },
    },
    'svc.cardBathroomsTitle': {
      kind: 'text',
      id: 'svc.cardBathroomsTitle',
      content: { type: 'literal', value: 'Bathrooms' },
    },
    'svc.cardBathroomsBody': {
      kind: 'text',
      id: 'svc.cardBathroomsBody',
      content: {
        type: 'literal',
        value:
          'Water where it should be, warmth where you want it. Accessible layouts designed in, never bolted on.',
      },
    },
    // The intentional instance override: accent framing + tinted background.
    'svc.cardAdaptations': {
      kind: 'component',
      id: 'svc.cardAdaptations',
      definitionId: 'def.serviceCard',
      styleSources: ['src.accent-override'],
      slots: {
        title: { name: 'title', children: ['svc.cardAdaptationsTitle'] },
        body: { name: 'body', children: ['svc.cardAdaptationsBody'] },
      },
    },
    'svc.cardAdaptationsTitle': {
      kind: 'text',
      id: 'svc.cardAdaptationsTitle',
      content: { type: 'literal', value: 'Adaptations' },
    },
    'svc.cardAdaptationsBody': {
      kind: 'text',
      id: 'svc.cardAdaptationsBody',
      content: {
        type: 'literal',
        value:
          'Ageing-in-place retrofits with the same finishing standard as every other room — grab rails that look chosen, not added.',
      },
    },
    'svc.story': {
      kind: 'element',
      id: 'svc.story',
      tag: 'section',
      attributes: { 'aria-labelledby': 'svc.storyHeading' },
      styleSources: ['src.story-cols'],
      children: ['svc.storyMain', 'svc.storyAside'],
    },
    'svc.storyMain': {
      kind: 'element',
      id: 'svc.storyMain',
      tag: 'div',
      children: ['svc.storyHeading', 'svc.storyCopyA', 'svc.storyCopyB'],
    },
    'svc.storyHeading': {
      kind: 'element',
      id: 'svc.storyHeading',
      tag: 'h2',
      styleSources: ['src.services-head'],
      children: ['svc.storyHeadingText'],
    },
    'svc.storyHeadingText': {
      kind: 'text',
      id: 'svc.storyHeadingText',
      content: { type: 'literal', value: 'How we work' },
    },
    'svc.storyCopyA': {
      kind: 'element',
      id: 'svc.storyCopyA',
      tag: 'p',
      styleSources: ['src.story-copy'],
      children: ['svc.storyCopyAText'],
    },
    'svc.storyCopyAText': {
      kind: 'text',
      id: 'svc.storyCopyAText',
      content: {
        type: 'literal',
        value:
          'Northwind began as a two-person carpentry workshop in 2011. We still keep one crew per project, one named lead, and a paper copy of every drawing on site — because decisions get made where the work happens.',
      },
    },
    'svc.storyCopyB': {
      kind: 'element',
      id: 'svc.storyCopyB',
      tag: 'p',
      styleSources: ['src.story-copy'],
      children: ['svc.storyCopyBText'],
    },
    'svc.storyCopyBText': {
      kind: 'text',
      id: 'svc.storyCopyBText',
      content: {
        type: 'literal',
        value:
          'Surveys are candid. If a wall wants to stay standing, we say so; if a budget wants to stretch, we show you exactly where and why before a single cabinet is ordered.',
      },
    },
    'svc.storyAside': {
      kind: 'element',
      id: 'svc.storyAside',
      tag: 'aside',
      attributes: { 'aria-label': 'At a glance' },
      styleSources: ['src.sticky-aside'],
      children: ['svc.stickyCard'],
    },
    'svc.stickyCard': {
      kind: 'component',
      id: 'svc.stickyCard',
      definitionId: 'def.serviceCard',
      slots: {
        title: { name: 'title', children: ['svc.stickyCardTitle'] },
        body: { name: 'body', children: ['svc.stickyCardBody'] },
      },
    },
    'svc.stickyCardTitle': {
      kind: 'text',
      id: 'svc.stickyCardTitle',
      content: { type: 'literal', value: 'Every project, documented' },
    },
    'svc.stickyCardBody': {
      kind: 'text',
      id: 'svc.stickyCardBody',
      content: {
        type: 'literal',
        value:
          'Weekly photo logs, a live scope tracker, and one named lead from first sketch to final handover.',
      },
    },
    'svc.contact': {
      kind: 'element',
      id: 'svc.contact',
      tag: 'section',
      attributes: { 'aria-labelledby': 'svc.contactHeading' },
      styleSources: ['src.contact-block'],
      children: ['svc.contactHeading', 'svc.contactIntro', 'svc.form', 'svc.formFeedbackNote'],
    },
    'svc.contactHeading': {
      kind: 'element',
      id: 'svc.contactHeading',
      tag: 'h2',
      styleSources: ['src.services-head'],
      children: ['svc.contactHeadingText'],
    },
    'svc.contactHeadingText': {
      kind: 'text',
      id: 'svc.contactHeadingText',
      content: { type: 'literal', value: 'Request a quote' },
    },
    'svc.contactIntro': {
      kind: 'element',
      id: 'svc.contactIntro',
      tag: 'p',
      styleSources: ['src.hero-tag'],
      children: ['svc.contactIntroText'],
    },
    'svc.contactIntroText': {
      kind: 'text',
      id: 'svc.contactIntroText',
      content: {
        type: 'literal',
        value:
          'Tell us about your rooms and your timing. We answer within two working days with next steps — or an honest no.',
      },
    },
    'svc.form': {
      kind: 'element',
      id: 'svc.form',
      tag: 'form',
      attributes: { 'aria-label': 'Request a quote', novalidate: 'novalidate' },
      interactions: [{ on: 'submit', action: 'invokeAction', actionId: 'design.submitContact' }],
      children: [
        'svc.fieldNameLabel',
        'svc.fieldName',
        'svc.fieldEmailLabel',
        'svc.fieldEmail',
        'svc.fieldMessageLabel',
        'svc.fieldMessage',
        'svc.formRow',
      ],
    },
    'svc.fieldNameLabel': {
      kind: 'element',
      id: 'svc.fieldNameLabel',
      tag: 'label',
      attributes: { for: 'svc.fieldName' },
      styleSources: ['src.label-base'],
      children: ['svc.fieldNameLabelText'],
    },
    'svc.fieldNameLabelText': {
      kind: 'text',
      id: 'svc.fieldNameLabelText',
      content: { type: 'literal', value: 'Your name' },
    },
    'svc.fieldName': {
      kind: 'element',
      id: 'svc.fieldName',
      tag: 'input',
      attributes: {
        type: 'text',
        id: 'svc.fieldName',
        name: 'name',
        'aria-label': 'Your name',
        'aria-describedby': 'design-form-feedback',
        autocomplete: 'name',
      },
      styleSources: ['src.field-base', 'src.field-focus'],
      children: [],
    },
    'svc.fieldEmailLabel': {
      kind: 'element',
      id: 'svc.fieldEmailLabel',
      tag: 'label',
      attributes: { for: 'svc.fieldEmail' },
      styleSources: ['src.label-base'],
      children: ['svc.fieldEmailLabelText'],
    },
    'svc.fieldEmailLabelText': {
      kind: 'text',
      id: 'svc.fieldEmailLabelText',
      content: { type: 'literal', value: 'Email address' },
    },
    'svc.fieldEmail': {
      kind: 'element',
      id: 'svc.fieldEmail',
      tag: 'input',
      attributes: {
        type: 'email',
        id: 'svc.fieldEmail',
        name: 'email',
        'aria-label': 'Email address',
        'aria-describedby': 'design-form-feedback',
        autocomplete: 'email',
      },
      styleSources: ['src.field-base', 'src.field-focus'],
      children: [],
    },
    'svc.fieldMessageLabel': {
      kind: 'element',
      id: 'svc.fieldMessageLabel',
      tag: 'label',
      attributes: { for: 'svc.fieldMessage' },
      styleSources: ['src.label-base'],
      children: ['svc.fieldMessageLabelText'],
    },
    'svc.fieldMessageLabelText': {
      kind: 'text',
      id: 'svc.fieldMessageLabelText',
      content: { type: 'literal', value: 'What are you planning?' },
    },
    'svc.fieldMessage': {
      kind: 'element',
      id: 'svc.fieldMessage',
      tag: 'textarea',
      attributes: {
        id: 'svc.fieldMessage',
        name: 'message',
        rows: '4',
        'aria-label': 'What are you planning?',
        'aria-describedby': 'design-form-feedback',
      },
      styleSources: ['src.field-base', 'src.field-focus'],
      children: [],
    },
    'svc.formRow': {
      kind: 'element',
      id: 'svc.formRow',
      tag: 'div',
      children: ['svc.submitButton'],
    },
    'svc.submitButton': {
      kind: 'element',
      id: 'svc.submitButton',
      tag: 'button',
      attributes: { type: 'submit' },
      styleSources: ['src.submit-base', 'src.submit-hover'],
      children: ['svc.submitLabel'],
    },
    'svc.submitLabel': {
      kind: 'text',
      id: 'svc.submitLabel',
      content: { type: 'literal', value: 'Send request' },
    },
    'svc.formFeedbackNote': {
      kind: 'element',
      id: 'svc.formFeedbackNote',
      tag: 'p',
      styleSources: ['src.hero-tag'],
      children: ['svc.formFeedbackNoteText'],
    },
    'svc.formFeedbackNoteText': {
      kind: 'text',
      id: 'svc.formFeedbackNoteText',
      content: {
        type: 'literal',
        value:
          'We use your details only to reply to this request. Nothing is stored on this page between visits unless you save your edits.',
      },
    },
  },
};
