import { writable } from 'svelte/store';

// Store for student grade modal state
function createStudentGradeModalStore() {
	const { subscribe, set, update } = writable({
		isOpen: false,
		subject: null,
		quarterName: null,
		schoolYear: null
	});

	return {
		subscribe,
		open: (subject, quarterName, schoolYear) => {
			set({
				isOpen: true,
				subject,
				quarterName,
				schoolYear
			});
		},
		close: () => {
			set({
				isOpen: false,
				subject: null,
				quarterName: null,
				schoolYear: null
			});
		}
	};
}

export const studentGradeModalStore = createStudentGradeModalStore();
