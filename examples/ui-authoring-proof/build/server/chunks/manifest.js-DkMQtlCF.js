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
		client: {start:"_app/immutable/entry/start.B1q_EycU.js",app:"_app/immutable/entry/app.DUCv5x1h.js",imports:["_app/immutable/entry/start.B1q_EycU.js","_app/immutable/chunks/BOVszMWl.js","_app/immutable/chunks/DWRBVfzk.js","_app/immutable/chunks/Ckea3r8c.js","_app/immutable/entry/app.DUCv5x1h.js","_app/immutable/chunks/BOVszMWl.js","_app/immutable/chunks/BXOlZpij.js","_app/immutable/chunks/CVa_xE6x.js","_app/immutable/chunks/Ckea3r8c.js","_app/immutable/chunks/CmT3yktc.js","_app/immutable/chunks/aqHTk1Mq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./0-BHKTE8yY.js')),
			__memo(() => import('./1-BMfaWPr4.js')),
			__memo(() => import('./2-BHymSKfw.js')),
			__memo(() => import('./3-BF9TOlCA.js')),
			__memo(() => import('./4-D_RF8MgR.js'))
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
				id: "/inspection/[id]",
				pattern: /^\/inspection\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/studio",
				pattern: /^\/studio\/?$/,
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
//# sourceMappingURL=manifest.js-DkMQtlCF.js.map
