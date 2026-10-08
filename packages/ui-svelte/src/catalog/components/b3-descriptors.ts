import type { UiExtensionDescriptor, UiPropDecl, UiOutputDecl } from '@victframework/ui';
const label: UiPropDecl = { name: 'label', type: 'string', default: '' };
const disabled: UiPropDecl = { name: 'disabled', type: 'boolean', default: false };
const help = ['help'];
const numericProps: UiPropDecl[] = [label, { name: 'value', type: 'number', default: 0 }, { name: 'min', type: 'number', default: 0 }, { name: 'max', type: 'number', default: 100 }];
const dateProps: UiPropDecl[] = [label, disabled,
  { name: 'locale', type: 'string', default: 'en-GB' },
  { name: 'min', type: 'isoDate', default: '' }, { name: 'max', type: 'isoDate', default: '' },
  { name: 'placeholder', type: 'isoDate', default: '' },
  { name: 'readonly', type: 'boolean', default: false }, { name: 'required', type: 'boolean', default: false },
];
const calendarProps: UiPropDecl[] = [
  { name: 'weekStartsOn', type: 'number', default: 1 },
  { name: 'numberOfMonths', type: 'number', default: 1 },
];
const openProps: UiPropDecl[] = [{ name: 'open', type: 'boolean', default: false }];
const openOutputs: UiOutputDecl[] = [{ name: 'openChange', payload: 'boolean' }];
function descriptor(slug: string, props: UiPropDecl[], outputs: UiOutputDecl[], slots = help, styleTargets = ['root']): UiExtensionDescriptor {
  return { id: `vict.catalog.${slug}`, revision: '1', abi: 'vict.ui-component-abi@1', events: ['vict.ui-component-abi@1'], rendererImplementationId: 'vict.svelte.catalog', props, outputs, slots, styleTargets };
}
export const catalogSliderDescriptor = descriptor('slider', [label, disabled,
  { name: 'value', type: 'numberList', default: [] }, { name: 'min', type: 'number', default: 0 },
  { name: 'max', type: 'number', default: 100 }, { name: 'step', type: 'number', default: 1 },
  { name: 'orientation', type: 'string', default: 'horizontal' },
], [{ name: 'valueChange', payload: 'numberList' }, { name: 'valueCommit', payload: 'numberList' }]);
export const catalogMeterDescriptor = descriptor('meter', numericProps, [], ['content', 'help']);
export const catalogProgressDescriptor = descriptor('progress', [...numericProps, { name: 'indeterminate', type: 'boolean', default: false }], [], ['content', 'help']);
export const catalogPaginationDescriptor = descriptor('pagination', [label,
  { name: 'page', type: 'number', default: 1 }, { name: 'count', type: 'number', default: 0 },
  { name: 'perPage', type: 'number', default: 10 }, { name: 'siblingCount', type: 'number', default: 1 },
], [{ name: 'pageChange', payload: 'number' }]);
const single: UiPropDecl[] = [{ name: 'value', type: 'isoDate', default: '' }];
const singleOutputs: UiOutputDecl[] = [{ name: 'valueChange', payload: 'isoDate' }];
const range: UiPropDecl[] = [{ name: 'start', type: 'isoDate', default: '' }, { name: 'end', type: 'isoDate', default: '' }];
const rangeOutputs: UiOutputDecl[] = [{ name: 'startChange', payload: 'isoDate' }, { name: 'endChange', payload: 'isoDate' }];
export const catalogDateFieldDescriptor = descriptor('date-field', [...dateProps, ...single], singleOutputs);
export const catalogDatePickerDescriptor = descriptor('date-picker', [...dateProps, ...single, ...calendarProps, ...openProps], [...singleOutputs, ...openOutputs], ['help', 'content'], ['root', 'content']);
export const catalogCalendarDescriptor = descriptor('calendar', [...dateProps.filter((prop) => prop.name !== 'required'), ...single, ...calendarProps], singleOutputs);
export const catalogTimeFieldDescriptor = descriptor('time-field', [label, disabled,
  { name: 'value', type: 'isoTime', default: '' }, { name: 'min', type: 'isoTime', default: '' },
  { name: 'max', type: 'isoTime', default: '' }, { name: 'placeholder', type: 'isoTime', default: '' },
  { name: 'locale', type: 'string', default: 'en-GB' }, { name: 'hourCycle', type: 'number', default: 24 },
  { name: 'granularity', type: 'string', default: 'minute' },
  { name: 'readonly', type: 'boolean', default: false }, { name: 'required', type: 'boolean', default: false },
], [{ name: 'valueChange', payload: 'isoTime' }]);
export const catalogDateRangeFieldDescriptor = descriptor('date-range-field', [...dateProps, ...range], rangeOutputs);
export const catalogDateRangePickerDescriptor = descriptor('date-range-picker', [...dateProps, ...range, ...calendarProps, ...openProps], [...rangeOutputs, ...openOutputs], ['help', 'content'], ['root', 'content']);
export const catalogRangeCalendarDescriptor = descriptor('range-calendar', [...dateProps.filter((prop) => prop.name !== 'required'), ...range, ...calendarProps,
  { name: 'minDays', type: 'number', default: 1 }, { name: 'maxDays', type: 'number', default: 0 },
], rangeOutputs);
export const b3CatalogDescriptors: readonly UiExtensionDescriptor[] = [catalogSliderDescriptor, catalogMeterDescriptor, catalogProgressDescriptor, catalogPaginationDescriptor, catalogDateFieldDescriptor, catalogDatePickerDescriptor, catalogCalendarDescriptor, catalogTimeFieldDescriptor, catalogDateRangeFieldDescriptor, catalogDateRangePickerDescriptor, catalogRangeCalendarDescriptor];
