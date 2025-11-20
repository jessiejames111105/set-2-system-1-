<script>
  import { authStore } from '../components/login/js/auth.js';
  import Login from '../components/login/loginpage.svelte';
  import StudentNavbar from '../components/users/student/navigations/studentNavbar/studentNavbar.svelte';
  import StudentMenu from '../components/users/student/navigations/studentMenu/studentMenu.svelte';
  import StudentProfile from '../components/users/student/sections/studentProfile/studentProfile.svelte';
  import StudentGrade from '../components/users/student/sections/studentGrade/studentGrade.svelte';
  import StudentClassRanking from '../components/users/student/sections/studentClassRanking/studentClassRanking.svelte';
  import StudentSchedule from '../components/users/student/sections/studentSchedule/studentSchedule.svelte';
  import StudentDocument from '../components/users/student/sections/studentDocumentRequest/studentDocumentRequest.svelte';
  import Notification from '../components/users/student/sections/studentNotification/studentNotification.svelte';
  import StudentTodoList from '../components/users/student/sections/studentTodolist/studentTodolist.svelte';
  import TeacherNavbar from '../components/users/teacher/navigations/teacherNavbar/teacherNavbar.svelte';
  import TeacherMenu from '../components/users/teacher/navigations/teacherMenu/teacherMenu.svelte';
  import TeacherProfile from '../components/users/teacher/sections/teacherProfile/teacherProfile.svelte';
  import TeacherSchedule from '../components/users/teacher/sections/teacherSchedule/teacherSchedule.svelte';
  import TeacherClassSelection from '../components/users/teacher/sections/teacherClassManagement/teacherClassSelection/teacherClassSelection.svelte';
  import TeacherClassList from '../components/users/teacher/sections/teacherClassManagement/teacherClassList/teacherClassList.svelte';
  import TeacherAdvisoryClass from '../components/users/teacher/sections/teacherAdvisoryClass/teacherAdvisoryClass.svelte';
  import AdminNavbar from '../components/users/admin/navigations/adminNavbar/adminNavbar.svelte';
  import AdminMenu from '../components/users/admin/navigations/adminMenu/adminMenu.svelte';
  import AdminDashboard from '../components/users/admin/sections/adminDashboard/adminDashboard.svelte';
  import AdminAccountCreation from '../components/users/admin/sections/adminAccountCreation/adminAccountCreation.svelte';
  import AdminStudentMasterlist from '../components/users/admin/sections/adminStudentMasterlist/adminStudentMasterlist.svelte';
  import AdminTeacherMasterlist from '../components/users/admin/sections/adminTeacherMasterlist/adminTeacherMasterlist.svelte';
  import AdminArchivedAccounts from '../components/users/admin/sections/adminArchivedAccounts/adminArchivedAccounts.svelte';
  import AdminStudentGradesList from '../components/users/admin/sections/adminStudentGradesList/adminStudentGradesList.svelte';
  import AdminScheduleManagement from '../components/users/admin/sections/adminScheduleManagement/adminScheduleManagement.svelte';
  import AdminSubjectsAndActivities from '../components/users/admin/sections/adminSubjectsAndActivities/adminSubjectsAndActivities.svelte';
  import AdminDepartmentManagement from '../components/users/admin/sections/adminDepartmentManagement/adminDepartmentManagement.svelte';
  import AdminDocumentRequests from '../components/users/admin/sections/adminDocumentRequests/adminDocumentRequests.svelte';
  import AdminSettings from '../components/users/admin/sections/adminSettings/adminSettings.svelte';
  import '../lib/styles/+page.css';

  // Subscribe to auth store using Svelte 5 runes
  let authState = $state();
  
  // Subscribe to auth store changes
  $effect(() => {
    const unsubscribe = authStore.subscribe(value => {
      authState = value;
    });
    return unsubscribe;
  });

  // Current active section for student portal
  let activeSection = $state('grades');
  
  // Request ID to open in document modal (when navigating from notification)
  let documentRequestIdToOpen = $state(null);
  
  // Current active section for teacher portal
  let teacherActiveSection = $state('students');
  
  // Current active section for admin portal
  let adminActiveSection = $state('dashboard');

  // Navigation rail visibility state (false = collapsed/icons only, true = expanded/with labels)
  let isNavRailVisible = $state(false);
  
  // Teacher navigation rail visibility state
  let teacherNavRailVisible = $state(false);
  
  // Admin navigation rail visibility state
  let adminNavRailVisible = $state(false);

  // Handle navigation from student menu
  function handleNavigation(event) {
    // Handle both event objects (from menu) and direct strings (from navbar)
    if (typeof event === 'string') {
      activeSection = event;
      documentRequestIdToOpen = null; // Clear any pending request ID
    } else {
      activeSection = event.detail.section;
      
      // If navigating to documents with a requestId, store it
      if (event.detail.requestId) {
        documentRequestIdToOpen = event.detail.requestId;
      } else {
        documentRequestIdToOpen = null;
      }
    }
  }
  
  // Handle navigation from teacher menu
  function handleTeacherNavigation(event) {
    // Handle both event objects (from menu) and direct strings (from navbar)
    if (typeof event === 'string') {
      teacherActiveSection = event;
    } else {
      teacherActiveSection = event.detail.section;
    }
    // Reset selected class when navigating away from class list
    const section = typeof event === 'string' ? event : event.detail.section;
    if (section !== 'class-list') {
      selectedClass = null;
    }
  }
  
  // Handle navigation to class list from class selection
  function handleNavigateToClassList(event) {
    const { yearLevel, sectionName, sectionId } = event.detail;
    // Store the selected class information for the class list component
    selectedClass = { yearLevel, sectionName, sectionId };
    teacherActiveSection = 'class-list';
  }
  
  // Handle back navigation from class list to class management
  function handleBackToClassManagement() {
    selectedClass = null;
    teacherActiveSection = 'students';
  }
  
  // Store selected class information
  let selectedClass = $state(null);
  
  // Handle navigation from admin menu
  function handleAdminNavigation(event) {
    adminActiveSection = event.detail.section;
  }
  
  // Handle navigation to settings from admin navbar
  function handleAdminNavigateToSettings() {
    adminActiveSection = 'settings';
  }

  // Handle navigation rail toggle
  function handleToggleNavRail() {
    isNavRailVisible = !isNavRailVisible;
  }
  
  // Handle teacher navigation rail toggle
  function handleTeacherToggleNavRail() {
    teacherNavRailVisible = !teacherNavRailVisible;
  }
  
  // Handle admin navigation rail toggle
  function handleAdminToggleNavRail() {
    adminNavRailVisible = !adminNavRailVisible;
  }

  // Handle logout
  async function handleLogout() {
    await authStore.logout();
    activeSection = 'grades'; // Reset to default section
    teacherActiveSection = 'students'; // Reset teacher section
    adminActiveSection = 'dashboard'; // Reset admin section
  }

  // Reactive title based on auth state
  let pageTitle = $derived(
    !authState?.isAuthenticated
      ? 'Login - High School Student Information System'
      : authState.userType === 'student'
      ? 'Student Portal - High School'
      : authState.userType === 'teacher'
      ? 'Teacher Portal - High School'
      : authState.userType === 'admin'
        ? 'Admin Portal - High School'
      : 'High School Student Information System'
  );
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content="High School Student Information System" />
</svelte:head>

<div class="app-container">
  {#if !authState?.isAuthenticated}
    <!-- Login Page -->
    <Login />
  {:else if authState.userType === 'student'}
    <!-- Student Portal -->
    <div class="student-portal" class:nav-rail-collapsed={!isNavRailVisible}>
      <StudentNavbar 
        studentName={authState.userData?.name || 'Student'}
        firstName={authState.userData?.firstName || 'Student'}
        gender={authState.userData?.gender || 'male'}
        accountNumber={authState.userData?.accountNumber || 'N/A'}
        profileImage={authState.userData?.profileImage}
        onlogout={handleLogout}
        onToggleNavRail={handleToggleNavRail}
        onnavigate={handleNavigation}
      />
      
      <main class="content-area">
        {#if activeSection === 'profile'}
          <StudentProfile />
        {:else if activeSection === 'grades'}
          <StudentGrade />
        {:else if activeSection === 'ranking'}
          <StudentClassRanking />
        {:else if activeSection === 'schedule'}
          <StudentSchedule />
        {:else if activeSection === 'documents'}
          <StudentDocument openRequestId={documentRequestIdToOpen} />
        {:else if activeSection === 'notifications'}
          <Notification onnavigate={handleNavigation} />
        {:else if activeSection === 'todo'}
          <StudentTodoList />
        {/if}
      </main>

      <StudentMenu {activeSection} {isNavRailVisible} onnavigate={handleNavigation} />
    </div>
  {:else if authState.userType === 'teacher'}
    <!-- Teacher Portal -->
    <div class="teacher-portal" class:nav-rail-collapsed={!teacherNavRailVisible}>
      <TeacherNavbar 
        teacherName={authState.userData?.name || 'Teacher'}
        firstName={authState.userData?.firstName || 'Teacher'}
        gender={authState.userData?.gender || 'male'}
        accountNumber={authState.userData?.accountNumber || 'N/A'}
        profileImage={authState.userData?.profileImage}
        onlogout={handleLogout}
        onToggleNavRail={handleTeacherToggleNavRail}
        onnavigate={handleTeacherNavigation}
      />
      
      <main class="content-area">
        {#if teacherActiveSection === 'profile'}
          <TeacherProfile />
        {:else if teacherActiveSection === 'schedule'}
          <TeacherSchedule />
        {:else if teacherActiveSection === 'students'}
          <TeacherClassSelection onNavigateToClassList={handleNavigateToClassList} />
        {:else if teacherActiveSection === 'class-list' && selectedClass}
          <TeacherClassList {selectedClass} onBackToClassManagement={handleBackToClassManagement} />
        {:else if teacherActiveSection === 'advisory'}
          <TeacherAdvisoryClass />
        {:else}
          <!-- Default to class management if no valid section or class list without selection -->
          <TeacherClassSelection onNavigateToClassList={handleNavigateToClassList} />
        {/if}
      </main>

      <TeacherMenu {teacherActiveSection} {teacherNavRailVisible} onnavigate={handleTeacherNavigation} teacherId={authState.userData?.id} />
    </div>
  {:else if authState.userType === 'admin'}
    <!-- Admin Portal -->
    <div class="admin-portal" class:nav-rail-collapsed={!adminNavRailVisible}>
      <AdminNavbar 
        adminName={authState.userData?.name || 'Admin'}
        firstName={authState.userData?.firstName || 'Admin'}
        gender={authState.userData?.gender || 'male'}
        accountNumber={authState.userData?.accountNumber || 'N/A'}
        profileImage={authState.userData?.profileImage}
        onlogout={handleLogout}
        onToggleNavRail={handleAdminToggleNavRail}
        onNavigateToSettings={handleAdminNavigateToSettings}
      />
      
      <main class="content-area">
        {#if adminActiveSection === 'dashboard'}
          <AdminDashboard />
        {:else if adminActiveSection === 'account-creation'}
          <AdminAccountCreation />
        {:else if adminActiveSection === 'student-masterlist'}
          <AdminStudentMasterlist />
        {:else if adminActiveSection === 'teacher-masterlist'}
          <AdminTeacherMasterlist />
        {:else if adminActiveSection === 'archived-accounts'}
          <AdminArchivedAccounts />
        {:else if adminActiveSection === 'student-grades-list'}
          <AdminStudentGradesList />
        {:else if adminActiveSection === 'schedule-management'}
          <AdminScheduleManagement />
        {:else if adminActiveSection === 'department-management'}
          <AdminDepartmentManagement />
        {:else if adminActiveSection === 'subjects-and-activities'}
          <AdminSubjectsAndActivities />
        {:else if adminActiveSection === 'document-requests'}
          <AdminDocumentRequests />
        {:else if adminActiveSection === 'settings'}
          <AdminSettings />
        {/if}
      </main>

      <AdminMenu {adminActiveSection} {adminNavRailVisible} onnavigate={handleAdminNavigation} />
    </div>
  {/if}
</div>
