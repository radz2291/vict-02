import { describe, expect, it } from 'vitest';
import type { Handle } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Boundary tests: they call the REAL `handle` hook with minimal RequestEvent
 * objects (plain Request + URL) and a pass-through resolver. Honest
 * limitation: the SvelteKit action is exercised directly as a function (not
 * through the full kit request pipeline), and static-asset serving is not
 * exercised.
 */

const handle = (await import('../src/hooks.server.js')).handle as Handle;
const { createSession, SESSION_COOKIE_NAME } = await import('../src/lib/server/session.js');

/** Every response body ever produced by this suite, for token canaries. */
const responseBodies: string[] = [];

function makeEvent(
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: string;
  } = {},
): RequestEvent {
  const url = new URL(`http://studio.local${path}`);
  const request = new Request(url, {
    method,
    headers: options.headers,
    ...(options.body !== undefined ? { body: options.body } : {}),
  });
  return {
    request,
    url,
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {
        throw new Error('cookies.set is not supported by this test double');
      },
      delete: () => {},
      serialize: () => '',
    },
    locals: {},
    params: {},
    route: { id: null },
    setHeaders: () => {},
    isSubRequest: false,
    isDataRequest: false,
    getClientAddress: () => '127.0.0.1',
    fetch: globalThis.fetch,
    platform: {},
    waitUntil: () => {},
  } as unknown as RequestEvent;
}

const PASS_THROUGH = async () => new Response('ok-next');

async function run(
  method: string,
  path: string,
  options: { headers?: Record<string, string>; body?: string } = {},
): Promise<Response> {
  const event = makeEvent(method, path, options);
  const response = (await handle({ event, resolve: PASS_THROUGH })) as Response;
  const text = await response.clone().text();
  if (text.length > 0) {
    responseBodies.push(text);
  }
  return response;
}

const JSON_HEADERS = {
  'content-type': 'application/json',
  origin: 'http://studio.local',
  accept: 'application/json',
};
const HTML_HEADERS = { accept: 'text/html' };

function sessionCookie(): string {
  const session = createSession('operator', 'studio-local-pass');
  if (session === null) {
    throw new Error('demo human credential missing');
  }
  return `${SESSION_COOKIE_NAME}=${session.sessionId}`;
}

describe('Studio request boundary', () => {
  it('unauthenticated page navigation redirects 303 to /login', async () => {
    await expect(run('GET', '/', { headers: HTML_HEADERS })).rejects.toMatchObject({
      status: 303,
      location: '/login',
    });
  });

  it('unauthenticated JSON fails closed 401, non-echoing', async () => {
    const response = await run('POST', '/anything', {
      headers: JSON_HEADERS,
      body: '{"payload":{}}',
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: false, code: 'VICT_STUDIO_UNAUTHENTICATED' });
  });

  it('JSON POST without x-vict-csrf is 403 VICT_STUDIO_CSRF', async () => {
    const response = await run('POST', '/anything', {
      headers: { ...JSON_HEADERS, cookie: sessionCookie() },
      body: '{"payload":{}}',
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, code: 'VICT_STUDIO_CSRF' });
  });

  it('JSON POST with a WRONG x-vict-csrf is 403 VICT_STUDIO_CSRF', async () => {
    const response = await run('POST', '/anything', {
      headers: { ...JSON_HEADERS, cookie: sessionCookie(), 'x-vict-csrf': 'deadbeef' },
      body: '{"payload":{}}',
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, code: 'VICT_STUDIO_CSRF' });
  });

  it('a missing Origin header on POST is 403 VICT_STUDIO_ORIGIN', async () => {
    const response = await run('POST', '/anything', {
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(),
        accept: 'application/json',
      },
      body: '{"payload":{}}',
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, code: 'VICT_STUDIO_ORIGIN' });
  });

  it('a mismatched Origin header on POST is 403 VICT_STUDIO_ORIGIN', async () => {
    const response = await run('POST', '/anything', {
      headers: { ...JSON_HEADERS, origin: 'http://evil.example', cookie: sessionCookie() },
      body: '{"payload":{}}',
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, code: 'VICT_STUDIO_ORIGIN' });
  });

  it('a non-http(s) Origin scheme is 403 VICT_STUDIO_ORIGIN', async () => {
    const response = await run('POST', '/anything', {
      headers: { ...JSON_HEADERS, origin: 'ftp://studio.local', cookie: sessionCookie() },
      body: '{"payload":{}}',
    });
    expect(response.status).toBe(403);
  });

  it('an authenticated GET passes through to the resolver', async () => {
    const response = await run('GET', '/', {
      headers: { ...HTML_HEADERS, cookie: sessionCookie() },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok-next');
  });

  it('static/_app assets pass through unauthenticated', async () => {
    const response = await run('GET', '/_app/immutable/entry/start.js');
    expect(await response.text()).toBe('ok-next');
  });

  it('login with a WRONG secret fails NON-ECHOING, identical for unknown labels', async () => {
    const { actions } = await import('../src/routes/login/+page.server.js');
    const attempt = async (label: string, secret: string) => {
      const request = new Request('http://studio.local/login?/default', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ label, secret }).toString(),
      });
      return actions.default({
        request,
        cookies: { set: () => {}, get: () => undefined },
      } as unknown as Parameters<typeof actions.default>[0]);
    };
    const wrongSecret = (await attempt('operator', 'wrong-pass')) as {
      status: number;
      data?: unknown;
    };
    const unknownLabel = (await attempt('ghost', 'wrong-pass')) as {
      status: number;
      data?: unknown;
    };
    expect(wrongSecret.status).toBe(401);
    expect(unknownLabel.status).toBe(401);
    expect(wrongSecret.data).toEqual({ failed: true });
    expect(unknownLabel.data).toEqual(wrongSecret.data);
    expect(JSON.stringify(wrongSecret)).not.toContain('wrong-pass');
    expect(JSON.stringify(unknownLabel)).not.toContain('studio-local-pass');
  });

  it('login success sets an HttpOnly SameSite=Lax cookie and redirects 303 to /', async () => {
    const { actions } = await import('../src/routes/login/+page.server.js');
    const request = new Request('http://studio.local/login?/default', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ label: 'operator', secret: 'studio-local-pass' }).toString(),
    });
    let setCookie = '';
    let setOptions: Record<string, unknown> = {};
    await expect(
      actions.default({
        request,
        cookies: {
          set: (_name: string, _value: string, options: unknown) => {
            setCookie = `${_name}=${_value}`;
            setOptions = { ...(options as Record<string, unknown>) };
          },
          get: () => undefined,
        },
      } as unknown as Parameters<typeof actions.default>[0]),
    ).rejects.toMatchObject({ status: 303, location: '/' });
    expect(setCookie).toMatch(/^vict_studio_session=[0-9a-f]+$/);
    expect(setOptions['httpOnly']).toBe(true);
    expect(setOptions['sameSite']).toBe('lax');
    expect(setOptions['path']).toBe('/');
    expect(setCookie).not.toContain('studio-local-pass');
  });

  it('logout POST destroys the session, clears the cookie, redirects to /login', async () => {
    const cookie = sessionCookie();
    const response = await run('POST', '/logout', {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'http://studio.local',
        accept: 'text/html',
        cookie,
      },
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});

describe('credential canaries', () => {
  it('NO response body in the suite contains any demo token or human secret', () => {
    const canaries = ['vict-studio-demo-operator', 'vict-studio-demo-detail', 'studio-local-pass'];
    for (const body of responseBodies) {
      for (const canary of canaries) {
        expect(body).not.toContain(canary);
      }
    }
  });
});
