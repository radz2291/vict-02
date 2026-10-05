import type { LoadEvent } from '@sveltejs/kit';

export function load(event: LoadEvent) {
  return {
    actorRole: event.url.searchParams.get('as') === 'technician' ? 'technician' : 'supervisor',
  };
}
