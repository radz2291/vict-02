const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.CiucwLhX.js",app:"_app/immutable/entry/app.8KffC-7V.js",imports:["_app/immutable/entry/start.CiucwLhX.js","_app/immutable/chunks/CLBG_HfV.js","_app/immutable/chunks/B_uE0G1U.js","_app/immutable/chunks/CY5HpV_B.js","_app/immutable/entry/app.8KffC-7V.js","_app/immutable/chunks/CLBG_HfV.js","_app/immutable/chunks/Dg8wGopG.js","_app/immutable/chunks/C7z17n8S.js","_app/immutable/chunks/CY5HpV_B.js","_app/immutable/chunks/qZSt_3cZ.js","_app/immutable/chunks/FeHnI-_C.js","_app/immutable/chunks/FavoZziY.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./0-BmcDqJNJ.js')),
			__memo(() => import('./1-CB3qb0Lp.js')),
			__memo(() => import('./2-BAuvmu3x.js')),
			__memo(() => import('./3-BAzESITQ.js')),
			__memo(() => import('./4-I4DANkYD.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/service",
				pattern: /^\/service\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/workbench",
				pattern: /^\/workbench\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

export { manifest as m };
//# sourceMappingURL=manifest.js-CxMHPSbD.js.map
