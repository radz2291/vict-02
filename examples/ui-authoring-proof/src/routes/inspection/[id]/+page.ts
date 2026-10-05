import type { LoadEvent } from '@sveltejs/kit';

export function load(event: LoadEvent) {
  return {
    id: event.params.id,
    actorRole: event.url.searchParams.get('as') === 'technician' ? 'technician' : 'supervisor',
  };
}
