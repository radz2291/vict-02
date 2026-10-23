# Upstream provenance

Checked 2026-10-23 before implementation. This package uses the unmodified npm
distribution `@xyflow/svelte@1.7.0`, MIT license, from
https://github.com/xyflow/xyflow. The annotated release tag
`@xyflow/svelte@1.7.0` resolves to commit
`3d35b57317576b0916c0bfeaaedd573aaacc2839` (tag object
`36f4daa05e837aa339d0a1c834c25bec7b3ec0d2`). Registry integrity:
`sha512-Q80coEUlaf/x20dMtTZYd5VinJrkqr8H5sS2zp7rFS6RmHF8JB5akV6Qy5mvIb23tWfHPS3hMovbbzN6u/4ppw==`.

The npm distribution retains upstream's MIT LICENSE. No upstream source is
copied or patched. The local Apache-2.0 package composes existing Background,
Controls and MiniMap components and reexports the upstream public API. Its
Svelte peer is `^5.25.0`, compatible with the workspace's Svelte 5 family.
Exact installed-version and production-build verification is recorded in the
Cycle 1.3 evidence. Neither package nor wrapper depends on Bits UI or Tailwind.

References inspected: https://svelteflow.dev/learn and
https://svelteflow.dev/api-reference/svelte-flow. Importing JavaScript does not
install a stylesheet. The explicit styles entry includes upstream Flow CSS;
there is no global preflight/reset. Applications choose their own theme and
must give the canvas container a width and height.

Completion round, 2026-10-24: the package also contains original SourceNode,
RoutedEdge, FlowNavigation, measured layout orchestration and stale-result fence
helpers. They are VICT-authored presentation adapters, not copied upstream
components or new authoring/execution semantics. Both layout engines are
unmodified npm dependencies:

| Dependency | Exact version | License | Source |
| --- | --- | --- | --- |
| @dagrejs/dagre | 1.1.5 | MIT | https://github.com/dagrejs/dagre |
| elkjs | 0.11.0 | EPL-2.0 | https://github.com/kieler/elkjs |

Registry tarball integrity is retained in the workspace lockfile. Their license
files remain in their distributions. No upstream engine source is copied into
the package. The official layout references below informed the adapter; they
were evaluated against the pinned Svelte Flow 1.7.0 API rather than copied as
proof of integration:

- https://svelteflow.dev/examples/layout/dagre
- https://svelteflow.dev/examples/layout/elkjs
- https://svelteflow.dev/examples/layout/horizontal-flow
- https://svelteflow.dev/learn/layouting/sub-flows

Synthetic 12/89/500-node comparisons use variable supplied measured sizes, both
orientations and actual engines. The initial unbounded ELK result is retained:
500 expanded nodes took about 48–65 seconds on this host. The selected adapter
enforces a 120-visible-node ELK bound and falls back to Dagre above it; it returns
the actual choice and reason. Group/collapse remains a consumer source projection,
not automatic canonical reparenting or a claim that native compound subflows
have been implemented. See the source repository's completion/structure evidence.
