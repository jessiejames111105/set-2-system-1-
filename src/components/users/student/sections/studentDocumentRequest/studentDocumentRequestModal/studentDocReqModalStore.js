import { writable } from 'svelte/store';

// Store for student document request modal state
function createStudentDocReqModalStore() {
	const { subscribe, set, update } = writable({
		isOpen: false,
		request: null,
		onCancel: null,
		onRefresh: null
	});

	return {
		subscribe,
		open: (request, onCancel, onRefresh) => {
			set({
				isOpen: true,
				request,
				onCancel,
				onRefresh
			});
		},
		close: () => {
			set({
				isOpen: false,
				request: null,
				onCancel: null,
				onRefresh: null
			});
		}
	};
}

export const studentDocReqModalStore = createStudentDocReqModalStore();

