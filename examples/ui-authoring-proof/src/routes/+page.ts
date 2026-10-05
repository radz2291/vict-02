import type { LoadEvent } from '@sveltejs/kit';
import { InspectionDataAdapter, createInspectionServer, seedDomain } from '$lib/product/domain.js';

export function load(event: LoadEvent) {
  const server = createInspectionServer(new InspectionDataAdapter(seedDomain()));
  return server
    .dispatch('inspection.list', {}, { role: 'supervisor', actorId: 'server' })
    .then((result) => ({
      actorRole: event.url.searchParams.get('as') === 'technician' ? 'technician' : 'supervisor',
      rows: result.ok ? ((result.value as { rows: Record<string, unknown>[] }).rows ?? []) : [],
    }));
}
