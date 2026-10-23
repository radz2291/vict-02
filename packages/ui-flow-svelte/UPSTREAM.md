# Upstream provenance

Checked 2026-10-23 before implementation. This package uses the unmodified npm
distribution `@xyflow/svelte@1.7.0`, MIT license, from
https://github.com/xyflow/xyflow. The annotated release tag
`@xyflow/svelte@1.7.0` resolves to commit
`3d35b57317576b0916c0bfeaaedd573aaacc2839` (tag object
`36f4daa05e837aa339d0a1c834c25bec7b3ec0d2`). Registry integrity:
`sha512-Q80coEUlaf/x20dMtTZYd5VinJrkqr8H5sS2zp7rFS6RmHF8JB5akV6Qy5mvIb23tWfHPS3hMovbbzN6u/4ppw==`.

The npm distribution retains upstream's MIT LICENSE. No upstream source is
copied or patched. The local Apache-2.0 wrapper composes existing Background,
Controls and MiniMap components and reexports the upstream public API. Its
Svelte peer is `^5.25.0`, compatible with the workspace's Svelte 5 family.
Exact installed-version and production-build verification is recorded in the
Cycle 1.3 evidence. Neither package nor wrapper depends on Bits UI or Tailwind.

References inspected: https://svelteflow.dev/learn and
https://svelteflow.dev/api-reference/svelte-flow. Importing JavaScript does not
install a stylesheet. The explicit styles entry includes upstream Flow CSS;
there is no global preflight/reset. Applications choose their own theme and
must give the canvas container a width and height.
