// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ChatMessage from '../../src/lib/designer/ChatMessage.svelte';
import { messageHref } from '../../src/lib/designer/markdown.js';

let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
});
function render(text: string) {
  instance = mount(ChatMessage, { target: document.body, props: { text } });
  flushSync();
}
describe('Studio agent message formatting', () => {
  it('preserves reference-style image alt text without fetching an image', () => {
    render('![Chart description][chart]\n\n[chart]: https://example.com/chart.png');
    expect(document.body.textContent).toContain('Chart description');
    expect(document.querySelector('img')).toBeNull();
  });
  it('formats headings, lists, emphasis and code without oversized document headings', () => {
    render('# Registration\n\n- **Name** field\n- Email with `validation`\n\nDone.');
    expect(document.querySelector('h3')?.textContent).toBe('Registration');
    expect(document.querySelectorAll('li')).toHaveLength(2);
    expect(document.querySelector('strong')?.textContent).toBe('Name');
    expect(document.querySelector('code')?.textContent).toBe('validation');
    expect(document.querySelector('h1')).toBeNull();
  });
  it('escapes provider HTML and forbids executable links and remote images', () => {
    render(
      '<img src=x onerror=alert(1)>\n\n[Bad](javascript:alert(1)) [Good](https://example.com/path) ![Private image](https://example.com/pixel)',
    );
    expect(document.querySelector('img,script,iframe')).toBeNull();
    expect(document.body.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(document.querySelectorAll('a')).toHaveLength(1);
    expect(document.querySelector('a')?.rel).toBe('noopener noreferrer');
    expect(document.body.textContent).toContain('Private image');
    for (const url of ['javascript:alert(1)', 'data:text/html,x', '/design', '//example.com'])
      expect(messageHref(url)).toBeUndefined();
  });
  it('renders a partial streamed reply without requiring complete Markdown', () => {
    render('Creating **registration\n\n- Name\n- ');
    expect(document.body.textContent).toContain('registration');
    expect(document.querySelectorAll('li')).toHaveLength(2);
  });
});
