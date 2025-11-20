<script>
	import favicon from '$lib/assets/favicon.svg';
	import faviconAdmin from '$lib/assets/favicon-admin.svg';
	import faviconStudent from '$lib/assets/favicon-student.svg';
	import faviconTeacher from '$lib/assets/favicon-teacher.svg';
	import '../lib/styles/design-system.css';
	import ToastContainer from '../components/common/ToastContainer.svelte';
	import ModalContainer from '../components/common/ModalContainer.svelte';
	import DocumentRequestModalContainer from '../components/users/admin/sections/adminDocumentRequests/adminDocumentRequestModal/AdminDocumentRequestModalContainer.svelte';
	import StudentDocumentRequestModalContainer from '../components/users/student/sections/studentDocumentRequest/studentDocumentRequestModal/StudentDocumentRequestModalContainer.svelte';
	import StudentGradeModalContainer from '../components/users/student/sections/studentGrade/studentGradeModal/StudentGradeModalContainer.svelte';
	import { authStore } from '../components/login/js/auth.js';
	import { onMount } from 'svelte';
	import { tick } from 'svelte';
	
	let { children } = $props();
	let isAuthInitialized = $state(false);
	let authState = $state();
	
	// Subscribe to auth store changes
	$effect(() => {
		const unsubscribe = authStore.subscribe(value => {
			authState = value;
		});
		return unsubscribe;
	});
	
	// Reactive favicon based on user type
	let currentFavicon = $derived(
		!authState?.isAuthenticated
			? favicon
			: authState.userType === 'admin'
			? faviconAdmin
			: authState.userType === 'student'
			? faviconStudent
			: authState.userType === 'teacher'
			? faviconTeacher
			: favicon
	);
	
	// Initialize auth store
	onMount(() => {		
	
		setTimeout(() => {
			authStore.initialize();
			isAuthInitialized = true;
			
		
			if (window.appLoadingManager) {
				window.appLoadingManager.setReady();
			}
		}, 2800);
	});
</script>

<svelte:head>
	<link rel="icon" href={currentFavicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet" />
	<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
	<meta name="theme-color" content="#1565c0" />
</svelte:head>

<!-- Only render children after auth is initialized to prevent flash -->
{#if isAuthInitialized}
	{@render children?.()}
{/if}

<!-- Global toast container -->
<ToastContainer />

<!-- Global modal container -->
<ModalContainer />

<!-- Admin Document Request Modal Container -->
<DocumentRequestModalContainer />

<!-- Student Document Request Modal Container -->
<StudentDocumentRequestModalContainer />

<!-- Student Grade Modal Container -->
<StudentGradeModalContainer />
