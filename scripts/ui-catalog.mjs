process.env.VICT_PREVIEW_PORT = process.env.VICT_PREVIEW_PORT ?? '5180';
console.log(`VICT catalog: http://127.0.0.1:${process.env.VICT_PREVIEW_PORT}/catalog`);
console.log(`Request flow: http://127.0.0.1:${process.env.VICT_PREVIEW_PORT}/requests/schedule`);
await import('./ui-composition.mjs');
