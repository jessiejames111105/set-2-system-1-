<script>
  import { onMount } from 'svelte';
  import { authStore } from '../../../../../login/js/auth.js';
  import { api } from '../../../../../../routes/api/helper/api-helper.js';
  import './teacherClassSelection.css';
  import CountUp from '../../../../../common/CountUp.svelte';
  
  // Props for navigation
  let { onNavigateToClassList } = $props();
  
  // State variables
  let teacherData = $state({
    name: "Loading...",
    yearLevels: [],
    totalSections: 0,
    totalStudents: 0,
    averagePerSection: 0
  });

  let classData = $state([]);
  let loading = $state(true);
  let error = $state(null);

  // Function to handle section card click
  function handleSectionClick(yearLevel, sectionName, sectionId) {
    if (onNavigateToClassList) {
      onNavigateToClassList({ detail: { yearLevel, sectionName, sectionId } });
    }
  }

  // Array of border color classes for each stat card
  const borderColors = ['border-blue', 'border-green', 'border-orange', 'border-purple'];

  // Function to get border color by index
  function getBorderColorByIndex(index) {
    return borderColors[index % borderColors.length];
  }

  // Dynamic stats configuration
  let statsConfig = [
    {
      id: 'year-levels',
      label: 'Year Levels',
      getValue: () => teacherData.yearLevels.length,
      icon: 'school',
      color: 'var(--school-primary)'
    },
    {
      id: 'sections',
      label: 'Total Sections',
      getValue: () => teacherData.totalSections,
      icon: 'class',
      color: 'var(--school-secondary)'
    },
    {
      id: 'students',
      label: 'Total Students',
      getValue: () => teacherData.totalStudents,
      icon: 'people',
      color: 'var(--success)'
    },
    {
      id: 'average',
      label: 'Average Per Section',
      getValue: () => teacherData.averagePerSection,
      icon: 'analytics',
      color: 'var(--school-accent)'
    }
  ];

  // Fetch teacher's sections from API
  async function fetchTeacherSections() {
    try {
      loading = true;
      error = null;

      // Get current user data from auth store
      const authState = $authStore;
      if (!authState.isAuthenticated || !authState.userData?.id) {
        throw new Error('User not authenticated');
      }

      const teacherId = authState.userData.id;
      
      // Fetch current school year from admin settings
      const currentQuarterData = await api.get('/api/current-quarter');
      const schoolYear = currentQuarterData.data?.currentSchoolYear || '2025-2026';

      // Use api helper to include authentication headers
      const result = await api.get(`/api/teacher-sections?teacherId=${teacherId}&schoolYear=${schoolYear}`);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch teacher sections');
      }

      // Update teacher data and class data
      classData = result.data.classData;
      teacherData = {
        name: authState.userData.name || 'Teacher',
        yearLevels: result.data.stats.yearLevels,
        totalSections: result.data.stats.totalSections,
        totalStudents: result.data.stats.totalStudents,
        averagePerSection: result.data.stats.averagePerSection
      };

    } catch (err) {
      console.error('Error fetching teacher sections:', err);
      error = err.message;
      // Fallback to empty data
      classData = [];
      teacherData = {
        name: 'Teacher',
        yearLevels: [],
        totalSections: 0,
        totalStudents: 0,
        averagePerSection: 0
      };
    } finally {
      loading = false;
    }
  }

  // Load data on component mount
  onMount(() => {
    fetchTeacherSections();
  });


</script>

<div class="class-management-container">
  <!-- Header Section -->
  <div class="class-mgmt-page-header fade-in">
    <div class="header-content">
      <h1 class="class-mgmt-page-title">Class Management</h1>
      <p class="class-mgmt-page-subtitle">Overview of your teaching assignments and student distribution</p>
    </div>
  </div>

  <!-- Stats Cards Section -->
  <div class="class-mgmt-stats-section">
    <div class="class-mgmt-stats-grid">
      {#each statsConfig as stat, index (stat.id)}
        <div class="class-mgmt-stat-card {getBorderColorByIndex(index)} stagger-item" style="--stagger-index: {index}">
          <div class="stat-card-header">
            <p class="class-mgmt-stat-label">{stat.label}</p>
            <div class="class-mgmt-stat-icon">
              <span class="material-symbols-outlined">{stat.icon}</span>
            </div>
          </div>
          <div class="stat-card-content">
            <h3 class="class-mgmt-stat-value">
              <CountUp 
                value={stat.getValue()} 
                decimals={0} 
                duration={2}
              />
            </h3>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Year Levels and Sections Section -->
  <div class="classes-section-container">
    <h2 class="class-mgmt-section-title">Year Levels & Sections</h2>
    
    {#if loading}
      <div class="loading-container">
        <div class="system-loader"></div>
        <p>Loading your teaching assignments...</p>
      </div>
    {:else if error}
      <div class="error-container">
        <div class="error-icon">
          <span class="material-symbols-outlined">error</span>
        </div>
        <p class="error-message">Error: {error}</p>
        <button class="retry-button" onclick={fetchTeacherSections}>
          <span class="material-symbols-outlined">refresh</span>
          Retry
        </button>
      </div>
    {:else if classData.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <span class="material-symbols-outlined">school</span>
        </div>
        <h3>No Teaching Assignments</h3>
        <p>You don't have any sections assigned for this school year.</p>
      </div>
    {:else}
      <div class="year-levels-grid">
        {#each classData as yearData, yearIndex (yearData.yearLevel)}
          <div class="year-level-container stagger-item" style="--stagger-index: {yearIndex}">
            <!-- Year Level Header -->
            <div class="year-level-header">
              <div class="year-level-info">
                <div class="year-level-icon">
                  <span class="material-symbols-outlined">school</span>
                </div>
                <div class="year-level-details">
                  <h3 class="year-level-title">{yearData.gradeName}</h3>
                  <p class="year-level-summary">{yearData.sections.length} section{yearData.sections.length !== 1 ? 's' : ''} • {yearData.sections.reduce((sum, section) => sum + section.students, 0)} students</p>
                </div>
              </div>
            </div>

            <!-- Sections Grid -->
            <div class="sections-grid">
              {#each yearData.sections as section, sectionIndex (section.name)}
                <button 
                  class="section-card stagger-section-item" 
                  onclick={() => handleSectionClick(yearData.yearLevel, section.name, section.id)}
                  aria-label="View class list for {section.name}"
                  style="--stagger-index: {sectionIndex}"
                >
                  <div class="section-card-content">
                    <div class="section-name">{section.name}</div>
                    {#if section.subjects && section.subjects.length > 0}
                      <div class="section-subjects">
                        <span>{section.subjects.slice(0, 2).join(', ')}</span>
                        {#if section.subjects.length > 2}
                          <span class="more-subjects">+{section.subjects.length - 2} more</span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                  <div class="section-card-icon">
                    <span class="material-symbols-outlined">chevron_right</span>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>