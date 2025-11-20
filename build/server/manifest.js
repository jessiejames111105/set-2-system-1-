const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([".well-known/appspecific/com.chrome.devtools.json","icon.svg","manifest.json","pwa-192x192.png","pwa-512x512.png","robots.txt"]),
	mimeTypes: {".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".txt":"text/plain"},
	_: {
		client: {start:"_app/immutable/entry/start.DtcNGlrL.js",app:"_app/immutable/entry/app.v1lLjWZs.js",imports:["_app/immutable/entry/start.DtcNGlrL.js","_app/immutable/chunks/CMGJVHyi.js","_app/immutable/chunks/BrR45Eif.js","_app/immutable/entry/app.v1lLjWZs.js","_app/immutable/chunks/BrR45Eif.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/CsvhCkDi.js","_app/immutable/chunks/vM_StVem.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-CUrArFRl.js')),
			__memo(() => import('./chunks/1-B-soYAuP.js')),
			__memo(() => import('./chunks/2-DN057mQ2.js'))
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
				id: "/api/accounts",
				pattern: /^\/api\/accounts\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-mw15yEgJ.js'))
			},
			{
				id: "/api/accounts/check-email",
				pattern: /^\/api\/accounts\/check-email\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-CxHUkHU6.js'))
			},
			{
				id: "/api/accounts/next-number",
				pattern: /^\/api\/accounts\/next-number\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-ClN-HkkR.js'))
			},
			{
				id: "/api/activity-logs",
				pattern: /^\/api\/activity-logs\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-DZWYa7eu.js'))
			},
			{
				id: "/api/activity-types",
				pattern: /^\/api\/activity-types\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-yrm5-4i9.js'))
			},
			{
				id: "/api/admin-settings",
				pattern: /^\/api\/admin-settings\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-CzwKyvCO.js'))
			},
			{
				id: "/api/ai-grade-analysis",
				pattern: /^\/api\/ai-grade-analysis\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-DdCIwo49.js'))
			},
			{
				id: "/api/archived-accounts",
				pattern: /^\/api\/archived-accounts\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-DhwKxLjA.js'))
			},
			{
				id: "/api/auth",
				pattern: /^\/api\/auth\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-vFxnc-ts.js'))
			},
			{
				id: "/api/auth/heartbeat",
				pattern: /^\/api\/auth\/heartbeat\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-DeJ2fUQJ.js'))
			},
			{
				id: "/api/change-password",
				pattern: /^\/api\/change-password\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-Cem_mpin.js'))
			},
			{
				id: "/api/class-rankings",
				pattern: /^\/api\/class-rankings\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-B1aj0GCD.js'))
			},
			{
				id: "/api/class-students",
				pattern: /^\/api\/class-students\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-D3eFTdEq.js'))
			},
			{
				id: "/api/current-quarter",
				pattern: /^\/api\/current-quarter\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-Ch7s5C0j.js'))
			},
			{
				id: "/api/dashboard",
				pattern: /^\/api\/dashboard\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-D5zdczzX.js'))
			},
			{
				id: "/api/dashboard/sections-per-grade",
				pattern: /^\/api\/dashboard\/sections-per-grade\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-5d45jsMG.js'))
			},
			{
				id: "/api/dashboard/students-per-grade",
				pattern: /^\/api\/dashboard\/students-per-grade\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-lg0WpkjZ.js'))
			},
			{
				id: "/api/departments",
				pattern: /^\/api\/departments\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-BpRmuXtP.js'))
			},
			{
				id: "/api/document-requests",
				pattern: /^\/api\/document-requests\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-BrqO-EO_.js'))
			},
			{
				id: "/api/forgot-password",
				pattern: /^\/api\/forgot-password\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-C-F3l6X3.js'))
			},
			{
				id: "/api/forgot-password/reset-password",
				pattern: /^\/api\/forgot-password\/reset-password\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-1osS2i2e.js'))
			},
			{
				id: "/api/forgot-password/verify-code",
				pattern: /^\/api\/forgot-password\/verify-code\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-CcSKCUbp.js'))
			},
			{
				id: "/api/grades",
				pattern: /^\/api\/grades\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-DkVzhzh_.js'))
			},
			{
				id: "/api/grades/grade-items",
				pattern: /^\/api\/grades\/grade-items\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-BBzp5p9e.js'))
			},
			{
				id: "/api/grades/save",
				pattern: /^\/api\/grades\/save\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-Bd-d29gA.js'))
			},
			{
				id: "/api/notifications",
				pattern: /^\/api\/notifications\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-sGh1ra_I.js'))
			},
			{
				id: "/api/rooms",
				pattern: /^\/api\/rooms\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-CRY4ukTQ.js'))
			},
			{
				id: "/api/schedules",
				pattern: /^\/api\/schedules\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-ozVkFURo.js'))
			},
			{
				id: "/api/sections",
				pattern: /^\/api\/sections\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-DEPjOk58.js'))
			},
			{
				id: "/api/student-grades",
				pattern: /^\/api\/student-grades\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-Bc_zQx5Y.js'))
			},
			{
				id: "/api/student-notifications",
				pattern: /^\/api\/student-notifications\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-sbxLEn3W.js'))
			},
			{
				id: "/api/student-profile",
				pattern: /^\/api\/student-profile\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-CuW-NaAX.js'))
			},
			{
				id: "/api/student-todos",
				pattern: /^\/api\/student-todos\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-MWHlX0Gv.js'))
			},
			{
				id: "/api/students-bulk",
				pattern: /^\/api\/students-bulk\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-CyM9qQir.js'))
			},
			{
				id: "/api/subjects",
				pattern: /^\/api\/subjects\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-DyouHPkW.js'))
			},
			{
				id: "/api/teacher-advisory",
				pattern: /^\/api\/teacher-advisory\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-CLfmeiwB.js'))
			},
			{
				id: "/api/teacher-profile",
				pattern: /^\/api\/teacher-profile\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-Bsd-SyVb.js'))
			},
			{
				id: "/api/teacher-sections",
				pattern: /^\/api\/teacher-sections\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-CnOcz2pp.js'))
			},
			{
				id: "/api/users",
				pattern: /^\/api\/users\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-BPUjYu2n.js'))
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

const prerendered = new Set([]);

const base = "";

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map
