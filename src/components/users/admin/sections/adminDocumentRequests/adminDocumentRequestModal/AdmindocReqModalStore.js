import { writable } from 'svelte/store';

// Store for document request modal state
function createDocReqModalStore() {
	const { subscribe, set, update } = writable({
		isOpen: false,
		request: null,
		requestStatuses: [],
		modalStatuses: [],
		onUpdate: null,
		onReject: null
	});

	return {
		subscribe,
		open: (request, requestStatuses, modalStatuses, onUpdate, onReject) => {
			set({
				isOpen: true,
				request,
				requestStatuses,
				modalStatuses,
				onUpdate,
				onReject
			});
		},
		close: () => {
			set({
				isOpen: false,
				request: null,
				requestStatuses: [],
				modalStatuses: [],
				onUpdate: null,
				onReject: null
			});
		}
	};
}

export const docReqModalStore = createDocReqModalStore();

