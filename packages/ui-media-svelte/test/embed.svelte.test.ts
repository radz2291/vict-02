import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import EmbedHost from './EmbedHost.svelte';

// The package test config disables iframe page loading. These are synthetic
// lifecycle events and a fake clock, never remote loading/playback evidence.
const mounted: { instance: ReturnType<typeof mount>; target: HTMLElement }[] = [];
const setup = () => {
  const target = document.createElement('div'); document.body.append(target);
  const instance = mount(EmbedHost, { target }); mounted.push({ instance, target });
  flushSync();
  return { instance, target, root: target.querySelector<HTMLElement>('.vict-media-embed')! };
};
afterEach(async () => {
  for (const { instance, target } of mounted.splice(0)) { await unmount(instance); target.remove(); }
  vi.useRealTimers();
});

describe('native allowlisted embed lifecycle (offline events, not provider proof)', () => {
  it('shows loading and clears it on a native load without claiming playback', () => {
    vi.useFakeTimers();
    const { target, root } = setup(), frame = target.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abcdefghijk');
    expect(frame.getAttribute('title')).toBe('Supplied video');
    expect(frame.getAttribute('loading')).toBe('lazy');
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(target.querySelector('[role=status]')?.textContent).toContain('Loading embedded frame');
    frame.dispatchEvent(new Event('load')); flushSync();
    expect(root.getAttribute('aria-busy')).toBe('false');
    expect(target.querySelector('[role=status]')).toBeNull();
    expect(target.querySelector('[role=alert]')).toBeNull();
    expect(target.textContent).not.toMatch(/playing|playback succeeded|video ready/i);
    vi.advanceTimersByTime(20_000); flushSync();
    expect(target.querySelector('[role=status]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports a measured slow load and native failure without inventing a cause', () => {
    vi.useFakeTimers();
    const { target, root } = setup(), frame = target.querySelector('iframe')!;
    vi.advanceTimersByTime(9_999); flushSync();
    expect(target.querySelector('[role=status]')?.textContent).toContain('Loading embedded frame');
    vi.advanceTimersByTime(1); flushSync();
    expect(target.querySelector('[role=status]')?.textContent).toContain('taking longer');
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(frame.isConnected).toBe(true);
    frame.dispatchEvent(new Event('error')); flushSync();
    expect(target.querySelector('[role=alert]')?.textContent).toBe('Embedded frame could not be loaded.');
    expect(root.getAttribute('aria-busy')).toBe('false');
    // Happy DOM schedules an immediate error-notification task. Drain only
    // that immediate work; a leaked 10-second lifecycle timer would remain.
    vi.advanceTimersByTime(0); flushSync();
    expect(vi.getTimerCount()).toBe(0);
    frame.dispatchEvent(new Event('load')); flushSync();
    expect(target.querySelector('[role=alert]')).not.toBeNull();
  });

  it('cancels the pending delay on an early error and recovers only for a new source', () => {
    vi.useFakeTimers();
    const { instance, target, root } = setup(), previous = target.querySelector('iframe')!;
    previous.dispatchEvent(new Event('error')); flushSync();
    vi.advanceTimersByTime(0); flushSync();
    expect(vi.getTimerCount()).toBe(0);
    expect(root.getAttribute('aria-busy')).toBe('false');
    expect(previous.hidden).toBe(true);
    previous.dispatchEvent(new Event('load')); flushSync();
    expect(target.querySelector('[role=alert]')).not.toBeNull();
    instance.replaceSource('vimeo', '123456'); flushSync();
    expect(target.querySelector('iframe')).not.toBe(previous);
    expect(target.querySelector('iframe')?.hidden).toBe(false);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(target.querySelector('[role=status]')?.textContent).toContain('Loading embedded frame');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('resets for a new source and ignores the previous frame events/timer', () => {
    vi.useFakeTimers();
    const { instance, target, root } = setup(), previous = target.querySelector('iframe')!;
    vi.advanceTimersByTime(9_000); flushSync();
    instance.replaceSource('vimeo', '123456'); flushSync();
    const current = target.querySelector('iframe')!;
    expect(current).not.toBe(previous);
    expect(current.getAttribute('src')).toBe('https://player.vimeo.com/video/123456');
    previous.dispatchEvent(new Event('load')); previous.dispatchEvent(new Event('error')); flushSync();
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(target.querySelector('[role=alert]')).toBeNull();
    vi.advanceTimersByTime(1_000); flushSync();
    expect(target.querySelector('[role=status]')?.textContent).toContain('Loading embedded frame');
    current.dispatchEvent(new Event('load')); flushSync();
    expect(root.getAttribute('aria-busy')).toBe('false');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up on disabled policy and unmount, preserving the existing refusal', async () => {
    vi.useFakeTimers();
    const { instance, target, root } = setup();
    expect(vi.getTimerCount()).toBe(1);
    instance.replaceProviders([]); flushSync();
    expect(target.querySelector('iframe')).toBeNull();
    expect(target.querySelector('[role=alert]')?.textContent).toContain('not enabled');
    expect(root.getAttribute('aria-busy')).toBe('false');
    expect(vi.getTimerCount()).toBe(0);
    instance.replaceProviders(['youtube']); flushSync();
    expect(vi.getTimerCount()).toBe(1);
    mounted.splice(mounted.findIndex(item => item.instance === instance), 1);
    await unmount(instance); target.remove();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(20_000); flushSync();
    expect(target.isConnected).toBe(false);
  });
});
