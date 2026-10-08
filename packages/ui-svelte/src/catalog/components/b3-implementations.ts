import type { UiSvelteComponentImplementation } from '../../document/extensions.js';
import Slider from './CatalogSlider.svelte';
import Meter from './CatalogMeter.svelte';
import Progress from './CatalogProgress.svelte';
import Pagination from './CatalogPagination.svelte';
import DateField from './CatalogDateField.svelte';
import DatePicker from './CatalogDatePicker.svelte';
import Calendar from './CatalogCalendar.svelte';
import TimeField from './CatalogTimeField.svelte';
import DateRangeField from './CatalogDateRangeField.svelte';
import DateRangePicker from './CatalogDateRangePicker.svelte';
import RangeCalendar from './CatalogRangeCalendar.svelte';

export const b3CatalogImplementations: readonly UiSvelteComponentImplementation[] = [
  { extensionId: 'vict.catalog.slider', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['help'], styleTargets: ['root'], component: Slider },
  { extensionId: 'vict.catalog.meter', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['content', 'help'], styleTargets: ['root'], component: Meter },
  { extensionId: 'vict.catalog.progress', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['content', 'help'], styleTargets: ['root'], component: Progress },
  { extensionId: 'vict.catalog.pagination', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['help'], styleTargets: ['root'], component: Pagination },
  { extensionId: 'vict.catalog.date-field', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['help'], styleTargets: ['root'], component: DateField },
  { extensionId: 'vict.catalog.date-picker', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['help', 'content'], styleTargets: ['root', 'content'], component: DatePicker },
  { extensionId: 'vict.catalog.calendar', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['help'], styleTargets: ['root'], component: Calendar },
  { extensionId: 'vict.catalog.time-field', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['help'], styleTargets: ['root'], component: TimeField },
  { extensionId: 'vict.catalog.date-range-field', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['help'], styleTargets: ['root'], component: DateRangeField },
  { extensionId: 'vict.catalog.date-range-picker', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['help', 'content'], styleTargets: ['root', 'content'], component: DateRangePicker },
  { extensionId: 'vict.catalog.range-calendar', revision: '1', rendererImplementationId: 'vict.svelte.catalog', abi: 'vict.ui-component-abi@1', slots: ['help'], styleTargets: ['root'], component: RangeCalendar },
];
