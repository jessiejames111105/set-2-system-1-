import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'favicon-admin.svg', 'favicon-student.svg', 'favicon-teacher.svg'],
			iconPaths: {
				faviconSVG: 'icon.svg',
				favicon32: 'pwa-192x192.png',
				favicon16: 'pwa-192x192.png',
				appleTouchIcon: 'pwa-192x192.png',
				maskIcon: 'icon.svg',
				msTileImage: 'pwa-512x512.png'
			},
			manifest: {
				name: 'SET-2 System',
				short_name: 'SET-2',
				description: 'Student Enrollment and Tracking System',
				theme_color: '#FFFFFF',
				background_color: '#ffffff',
				display: 'standalone',
				display_override: ['window-controls-overlay', 'standalone'],
				orientation: 'portrait-primary',
				scope: '/',
				start_url: '/',
				categories: ['education', 'productivity'],
				prefer_related_applications: false,
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'gstatic-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				]
			},
			devOptions: {
				enabled: true,
				type: 'module'
			}
		})
	],
	server: {
		allowedHosts: [
			'.ngrok-free.app',
			'.ngrok.io',
			'.ngrok.app'
		]
	}
});
