<script>
  import { onMount, onDestroy } from 'svelte';
  import { authStore } from '../../../../../login/js/auth.js';
  import { api } from '../../../../../../routes/api/helper/api-helper.js';
  import './teacherClassList.css';
  import Toast from '../../../../../common/Toast.svelte';
  import GradingSpreadsheet from './GradingSpreadsheet.svelte';
  
  // Props
  let { selectedClass, onBackToClassManagement } = $props();
  
  // State variables
  let loading = $state(true);
  let error = $state(null);
  let isDestroyed = $state(false); // Track component destruction
  let addingColumn = $state(false); // Track column addition in progress
  let sectionData = $state(null);
  let verificationCheckInterval = null; // For periodic verification status checking
  let currentQuarter = $state(1); // Current quarter from database
  let currentQuarterName = $state('1st Quarter'); // Current quarter name
  let currentSchoolYear = $state('2025-2026'); // Current school year from database
  let isQuarterDropdownOpen = $state(false); // Quarter dropdown state
  
  // Subject tab management
  let activeSubjectIndex = $state(0);
  let gradingSpreadsheetRef = $state(null); // Reference to GradingSpreadsheet component
  
  // Get current active subject
  let activeSubject = $derived(
    sectionData?.subjects?.[activeSubjectIndex] || null
  );

  // Quarter dropdown options
  const quarterOptions = [
    { id: 1, name: '1st Quarter', icon: 'looks_one' },
    { id: 2, name: '2nd Quarter', icon: 'looks_two' },
    { id: 3, name: '3rd Quarter', icon: 'looks_3' },
    { id: 4, name: '4th Quarter', icon: 'looks_4' }
  ];

  // Get selected quarter object
  const selectedQuarterObj = $derived(quarterOptions.find((q) => q.id === currentQuarter));
  
  // Tab navigation function with auto-save
  async function setActiveSubject(index) {
    
    if (!sectionData?.subjects || index < 0 || index >= sectionData.subjects.length) {
      return;
    }

    // Auto-save current grades before switching tabs
    if (gradingSpreadsheetRef && typeof gradingSpreadsheetRef.saveGrades === 'function') {
      try {
        await gradingSpreadsheetRef.saveGrades();
      } catch (error) {
        // Continue with tab switch even if save fails
      }
    }
    
    activeSubjectIndex = index;
    
    
    // Reset grading config when switching subjects
    gradingConfig = {
      writtenWork: {
        count: 0,
        weight: 0.30,
        label: "Written Work",
        totals: [],
        columnNames: [],
        columnPositions: [],
        gradeItemIds: []
      },
      performanceTasks: {
        count: 0,
        weight: 0.50,
        label: "Performance Tasks",
        totals: [],
        columnNames: [],
        columnPositions: [],
        gradeItemIds: []
      },
      quarterlyAssessment: {
        count: 0,
        weight: 0.20,
        label: "Quarterly Assessment",
        totals: [],
        columnNames: [],
        columnPositions: [],
        gradeItemIds: []
      }
    };
    
    // Wait for next tick to ensure activeSubject is updated
    setTimeout(async () => {
      try {
        // Fetch new grading configuration and student data for the selected subject
        await fetchGradingConfiguration();
        await fetchClassStudents();
      } catch (err) {
        console.error('Error fetching data for subject:', err);
      }
    }, 0);
  }
  
  // Reactive class information using Svelte 5 runes
  let classInfo = $derived(sectionData ? {
    yearLevel: sectionData.section.grade_level,
    sectionName: sectionData.section.section_name,
    gradeName: `Grade ${sectionData.section.grade_level}`,
    subject: activeSubject?.name || "No Subject",
    section: `Grade ${sectionData.section.grade_level} - ${sectionData.section.section_name}`,
    quarter: currentQuarterName,
    totalStudents: sectionData.students?.length || 0,
    adviser: `${sectionData.section.adviser_first_name || ''} ${sectionData.section.adviser_last_name || ''}`.trim() || 'No Adviser',
    room: sectionData.section.room_name || 'No Room'
  } : selectedClass ? {
    yearLevel: selectedClass.yearLevel,
    sectionName: selectedClass.sectionName,
    gradeName: `Grade ${selectedClass.yearLevel}`,
    subject: "Loading...",
    section: `Grade ${selectedClass.yearLevel} - ${selectedClass.sectionName}`,
    quarter: currentQuarterName,
    totalStudents: 0
  } : {
    yearLevel: 7,
    sectionName: "Section A",
    gradeName: "Grade 7",
    subject: "Mathematics",
    section: "Grade 7 - Section A",
    quarter: currentQuarterName,
    totalStudents: 0
  });

  // Dynamic student data from database
  let students = $state([]);

  // Fetch current quarter from the database based on system date
  async function fetchCurrentQuarter() {
    try {
      const result = await api.get('/api/current-quarter');

      if (result.success && result.data) {
        currentQuarter = result.data.currentQuarter;
        currentQuarterName = result.data.quarterName;
        currentSchoolYear = result.data.currentSchoolYear || '2025-2026';
        console.log(`Current quarter set to: ${currentQuarterName} (Quarter ${currentQuarter})`);
        console.log(`Current school year set to: ${currentSchoolYear}`);
      } else {
        // Default to 1st quarter if API fails
        currentQuarter = 1;
        currentQuarterName = '1st Quarter';
        currentSchoolYear = '2025-2026';
        console.warn('Failed to fetch current quarter, defaulting to 1st Quarter and 2025-2026');
      }
    } catch (error) {
      console.error('Error fetching current quarter:', error);
      // Default to 1st quarter if error occurs
      currentQuarter = 1;
      currentQuarterName = '1st Quarter';
      currentSchoolYear = '2025-2026';
    }
  }

  // Toggle quarter dropdown
  function toggleQuarterDropdown() {
    isQuarterDropdownOpen = !isQuarterDropdownOpen;
  }

  // Select quarter and close dropdown
  async function selectQuarter(quarter) {
    if (quarter.id !== currentQuarter) {
      currentQuarter = quarter.id;
      currentQuarterName = quarter.name;
      isQuarterDropdownOpen = false;
      // Fetch new data for the selected quarter
      await fetchGradingConfiguration();
      await fetchClassStudents();
    } else {
      isQuarterDropdownOpen = false;
    }
  }

  // Fetch existing grade items and build// Fetch grading configuration for the active subject
  async function fetchGradingConfiguration() {
    if (!selectedClass || !activeSubject) {
      return;
    }

    try {
      // Create user info object for authentication
      const userInfo = {
        id: $authStore.userData.id,
        name: $authStore.userData.name,
        account_number: $authStore.userData.accountNumber,
        account_type: $authStore.userData.account_type || $authStore.userData.accountType
      };

      const response = await fetch(`/api/grades/grade-items?section_id=${selectedClass.sectionId}&subject_id=${activeSubject.id}&grading_period_id=${currentQuarter}&teacher_id=${$authStore.userData.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-user-info': JSON.stringify(userInfo)
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();

      // The API returns { success: true, data: { writtenWork: [], performanceTasks: [], quarterlyAssessment: [] } }
      const data = result.data || {};

      // Create new grading config based on fetched data
      const newGradingConfig = {
        writtenWork: {
          count: data.writtenWork?.length || 0,
          weight: 0.30,
          label: "Written Work",
          totals: data.writtenWork?.map(item => item.totalScore) || [],
          columnNames: data.writtenWork?.map(item => item.name) || [],
          columnPositions: data.writtenWork?.map((_, index) => index + 1) || [],
          gradeItemIds: data.writtenWork?.map(item => item.id) || []
        },
        performanceTasks: {
          count: data.performanceTasks?.length || 0,
          weight: 0.50,
          label: "Performance Tasks",
          totals: data.performanceTasks?.map(item => item.totalScore) || [],
          columnNames: data.performanceTasks?.map(item => item.name) || [],
          columnPositions: data.performanceTasks?.map((_, index) => index + 1) || [],
          gradeItemIds: data.performanceTasks?.map(item => item.id) || []
        },
        quarterlyAssessment: {
          count: data.quarterlyAssessment?.length || 0,
          weight: 0.20,
          label: "Quarterly Assessment",
          totals: data.quarterlyAssessment?.map(item => item.totalScore) || [],
          columnNames: data.quarterlyAssessment?.map(item => item.name) || [],
          columnPositions: data.quarterlyAssessment?.map((_, index) => index + 1) || [],
          gradeItemIds: data.quarterlyAssessment?.map(item => item.id) || []
        }
      };

      gradingConfig = newGradingConfig;
      
    } catch (error) {
      console.error('Error fetching grading configuration:', error);
      showToastNotification('Failed to load grading configuration', 'error');
    }
  }

  // Fetch class students from API
  // Fetch basic section data without subject filtering
  async function fetchSectionData() {
    if (isDestroyed) return;
    
    try {
      error = null;

      if (!selectedClass?.sectionId) {
        throw new Error('No section selected');
      }

      // Get current user data from auth store
      const authState = $authStore;
      const teacherId = authState.isAuthenticated ? authState.userData?.id : null;

      const params = new URLSearchParams({
        sectionId: selectedClass.sectionId.toString()
        // Removed schoolYear - let backend determine it from the section
      });

      if (teacherId) {
        params.append('teacherId', teacherId.toString());
      }

      // Don't add subjectId to get all subjects for the section
      const response = await fetch(`/api/class-students?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch section data');
      }

      // Update sectionData only (without students)
      sectionData = result.data;

    } catch (err) {
      console.error('Error fetching section data:', err);
      error = err.message;
    }
  }

  async function fetchClassStudents() {
    
    if (isDestroyed) return; // Only prevent calls after destruction
    
    try {
      loading = true;
      error = null;

      if (!selectedClass?.sectionId) {
        throw new Error('No section selected');
      }

      if (!activeSubject?.id) {
        return;
      }

      // Get current user data from auth store
      const authState = $authStore;
      const teacherId = authState.isAuthenticated ? authState.userData?.id : null;

      const params = new URLSearchParams({
        sectionId: selectedClass.sectionId.toString(),
        schoolYear: currentSchoolYear
      });

      if (teacherId) {
        params.append('teacherId', teacherId.toString());
      }

      // Add subject ID to filter grades by subject
      if (activeSubject?.id) {
        params.append('subjectId', activeSubject.id.toString());
      }

      // Add grading period ID to filter grades by quarter
      if (currentQuarter) {
        params.append('gradingPeriodId', currentQuarter.toString());
      }

      const response = await fetch(`/api/class-students?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch class students');
      }

      // Update state with fetched data
      sectionData = result.data;
      
      // Transform student data to match expected structure
      students = result.data.students.map(student => ({
        ...student,
        // Transform grades structure to match frontend expectations
        writtenWork: student.grades?.written_work || [],
        performanceTasks: student.grades?.performance_tasks || [],
        quarterlyAssessment: student.grades?.quarterly_assessment || [],
        // Keep original grades data for reference
        grades: student.grades,
        // Use account_number as id if available, otherwise use existing id
        id: student.account_number || student.id,
        name: student.full_name || `${student.first_name} ${student.last_name}`,
        isVerified: (student.grades?.verified || student.grades?.verification?.verified) || false
      }));

    } catch (err) {
      console.error('Error fetching class students:', err);
      error = err.message;
      // Fallback to empty data
      sectionData = null;
      students = [];
    } finally {
      loading = false;
    }
  }

  // Function to check verification status without full reload
  async function checkVerificationStatus() {
    if (isDestroyed || !selectedClass?.sectionId || !activeSubject?.id) return;
    
    try {
      // Get current user data from auth store
      const authState = $authStore;
      const teacherId = authState.isAuthenticated ? authState.userData?.id : null;

      const params = new URLSearchParams({
        sectionId: selectedClass.sectionId.toString(),
        schoolYear: currentSchoolYear,
        verificationOnly: 'true' // Flag to indicate we only need verification status
      });

      if (teacherId) {
        params.append('teacherId', teacherId.toString());
      }

      if (activeSubject?.id) {
        params.append('subjectId', activeSubject.id.toString());
      }

      // Add grading period ID to check verification for correct quarter
      if (currentQuarter) {
        params.append('gradingPeriodId', currentQuarter.toString());
      }

      const response = await fetch(`/api/class-students?${params}`);
      const result = await response.json();

      if (result.success && result.data?.students) {
        // Update only the verification status of existing students
        const updatedStudents = students.map(student => {
          const updatedStudent = result.data.students.find(s => s.id === student.id);
          if (updatedStudent) {
            return { ...student, isVerified: updatedStudent.isVerified };
          }
          return student;
        });
        
        // Only update if there are actual changes
        const hasChanges = updatedStudents.some((student, index) => 
          student.isVerified !== students[index]?.isVerified
        );
        
        if (hasChanges) {
          students = updatedStudents;
        }
      }
    } catch (err) {
      console.error('Error checking verification status:', err);
      // Silently fail - don't disrupt user experience
    }
  }

  // Grading configuration
  let gradingConfig = $state({
    writtenWork: {
      count: 0,
      weight: 0.30, // 30%
      label: "Written Work",
      totals: [], // Total scores for each WW assessment
      columnNames: [],
      columnPositions: [],
      gradeItemIds: []
    },
    performanceTasks: {
      count: 0,
      weight: 0.50, // 50%
      label: "Performance Tasks",
      totals: [], // Total scores for each PT assessment
      columnNames: [],
      columnPositions: [],
      gradeItemIds: []
    },
    quarterlyAssessment: {
      count: 0,
      weight: 0.20, // 20%
      label: "Quarterly Assessment",
      totals: [], // Total scores for each QA assessment
      columnNames: [],
      columnPositions: [],
      gradeItemIds: []
    }
  });

  // Toast state
  let toastMessage = $state('');
  let toastType = $state('error');
  let showToast = $state(false);

  // Column configuration options
  let columnOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Close dropdowns when clicking outside
  function handleClickOutside(event) {
    // Close quarter dropdown when clicking outside
    if (!event.target.closest('.classlist-quarter-dropdown')) {
      isQuarterDropdownOpen = false;
    }
  }

  // Dropdown toggle functions - no longer needed
  // Removed dropdown functions since we're using buttons now

  // Check if any student has verified grades
  function hasVerifiedGrades() {
    return students.some(student => student.isVerified || student.verified);
  }

  // Add column function with duplicate prevention
  async function addColumn(category) {
    if (gradingConfig[category].count < 10 && !addingColumn && !isDestroyed) {
      try {
        addingColumn = true; // Prevent duplicate calls
    
        
        // Map category names to category IDs
        const categoryMap = {
          'writtenWork': 1,
          'performanceTasks': 2,
          'quarterlyAssessment': 3
        };

        const categoryId = categoryMap[category];
        if (!categoryId) {
          console.error('Invalid category:', category);
          return;
        }

        // Ensure we have proper authentication
        if (!$authStore.isAuthenticated || !$authStore.userData?.id) {
          console.error('User not authenticated');
          return;
        }

        // Generate default name for the new grade item
        const categoryLabels = {
          'writtenWork': 'WW',
          'performanceTasks': 'PT', 
          'quarterlyAssessment': 'QA'
        };
        const currentCount = gradingConfig[category].count;
        const defaultName = `${categoryLabels[category]} ${currentCount + 1}`;

        // Create user info object for authentication
        const userInfo = {
          id: $authStore.userData.id,
          name: $authStore.userData.name,
          account_number: $authStore.userData.accountNumber,
          account_type: $authStore.userData.account_type || $authStore.userData.accountType
        };

        // Call API to add grade item to database
        const response = await fetch('/api/grades/grade-items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-info': JSON.stringify(userInfo)
          },
          body: JSON.stringify({
            action: 'create_grade_item',
            section_id: selectedClass?.sectionId || sectionData?.section?.id,
            subject_id: activeSubject?.id || selectedClass?.subjectId || (sectionData?.subjects?.[0]?.id),
            grading_period_id: currentQuarter, // Use dynamic current quarter
            teacher_id: $authStore.userData.id,
            category: category,
            name: defaultName,
            total_score: 100
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to add grade item:', errorData.error);
          return;
        }

        const result = await response.json();

        // Update UI only after successful database operation
        gradingConfig[category].count += 1;
        
        // Add the new grade item ID to the gradeItemIds array
        if (!gradingConfig[category].gradeItemIds) {
          gradingConfig[category].gradeItemIds = [];
        }
        gradingConfig[category].gradeItemIds.push(result.data.id);
        
        // Add the new column name to the columnNames array
        if (!gradingConfig[category].columnNames) {
          gradingConfig[category].columnNames = [];
        }
        gradingConfig[category].columnNames.push(result.data.name);
        
        // Initialize columnPositions if it doesn't exist
        if (!gradingConfig[category].columnPositions) {
          gradingConfig[category].columnPositions = [];
          // Initialize with sequential numbers for existing columns
          for (let i = 0; i < gradingConfig[category].count - 1; i++) {
            gradingConfig[category].columnPositions[i] = i + 1;
          }
        }
        
        // Add the new column position (find the next available number)
        const existingPositions = gradingConfig[category].columnPositions || [];
        let nextPosition = 1;
        while (existingPositions.includes(nextPosition)) {
          nextPosition++;
        }
        gradingConfig[category].columnPositions.push(nextPosition);
        
        adjustStudentData(); // Ensure student data arrays match the new column count
        
      } catch (error) {
        console.error('Error adding column:', error);
      } finally {
        addingColumn = false; // Reset adding state
      }
    }
  }

  // Adjust student data based on column configuration
  function adjustStudentData() {
    students = students.map(student => {
      // Ensure student object exists and has required properties
      if (!student) return student;
      
      const newStudent = {
        ...student,
        writtenWork: Array(gradingConfig.writtenWork.count).fill(0).map((_, i) => student.writtenWork?.[i] || 0),
        performanceTasks: Array(gradingConfig.performanceTasks.count).fill(0).map((_, i) => student.performanceTasks?.[i] || 0),
        quarterlyAssessment: Array(gradingConfig.quarterlyAssessment.count).fill(0).map((_, i) => student.quarterlyAssessment?.[i] || 0)
      };
      return newStudent;
    });
  }

  // Calculate average with totals support
  function calculateAverage(scores, totals = null) {
    // Add defensive check for undefined/null scores
    if (!scores || !Array.isArray(scores)) {
      return '';
    }
    
    const validScores = scores.filter(score => score !== null && score !== undefined && score !== '');
    if (validScores.length === 0) return '';
    
    // If totals are provided, calculate percentage-based average
    if (totals && totals.length > 0) {
      let sum = 0;
      for (let i = 0; i < validScores.length; i++) {
        const score = parseFloat(validScores[i]);
        const total = totals[i] || 100; // Default to 100 if total not specified
        const percentage = (score / total) * 100;
        sum += percentage;
      }
      return Math.round((sum / validScores.length) * 10) / 10;
    } else {
      // Original calculation for backward compatibility
      const sum = validScores.reduce((acc, score) => acc + parseFloat(score), 0);
      return Math.round((sum / validScores.length) * 10) / 10;
    }
  }

  // Calculate final grade
  function calculateFinalGrade(student) {
    // Ensure student object exists and has required properties
    if (!student) return '';
    
    const wwAvg = calculateAverage(student.writtenWork, gradingConfig.writtenWork.totals);
    const ptAvg = calculateAverage(student.performanceTasks, gradingConfig.performanceTasks.totals);
    const qaAvg = calculateAverage(student.quarterlyAssessment, gradingConfig.quarterlyAssessment.totals);
    
    if (wwAvg === '' || ptAvg === '' || qaAvg === '') return '';
    
    const finalGrade = (wwAvg * gradingConfig.writtenWork.weight) + 
                      (ptAvg * gradingConfig.performanceTasks.weight) + 
                      (qaAvg * gradingConfig.quarterlyAssessment.weight);
    
    return Math.round(finalGrade * 10) / 10;
  }

  // Get grade status
  function getGradeStatus(grade) {
    if (grade >= 90) return 'excellent';
    if (grade >= 85) return 'good';
    if (grade >= 80) return 'satisfactory';
    if (grade >= 75) return 'needs-improvement';
    return 'no-grade';
  }

  // Show toast notification
  function showToastNotification(message, type = 'error') {
    // Clear any existing toast first
    showToast = false;
    
    // Use a small delay to ensure the previous toast is fully cleared
    setTimeout(() => {
      toastMessage = message;
      toastType = type;
      showToast = true;
    }, 50);
  }

  // Validate if input is a valid number
  function isValidNumber(value) {
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num) && num >= 0 && num <= 100;
  }

  // Handle grade input
  function updateGrade(studentIndex, category, scoreIndex, event) {
    const inputValue = event.target.value.trim();
    
    // Allow empty values
    if (inputValue === '') {
      students[studentIndex][category][scoreIndex] = 0;
      return;
    }
    
    // Validate if it's a valid number
    if (!isValidNumber(inputValue)) {
      showToastNotification('Please enter a valid number between 0 and 100', 'error');
      // Reset to previous value or 0
      event.target.value = students[studentIndex][category][scoreIndex] || '';
      return;
    }
    
    const value = parseFloat(inputValue);
    students[studentIndex][category][scoreIndex] = Math.min(100, Math.max(0, value));
  }

  // Load data on component mount
  onMount(async () => {
    if (!isDestroyed) { // Only check if component is not destroyed
      // First, fetch the current quarter based on system date
      await fetchCurrentQuarter();
      
      // Then fetch basic section data without subject filtering
      await fetchSectionData();
      
      // Wait for the next tick to ensure reactive variables are updated
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Ensure we have subjects and activeSubject is properly set
      if (sectionData?.subjects && sectionData.subjects.length > 0) {
        // Make sure activeSubjectIndex is valid
        if (activeSubjectIndex >= sectionData.subjects.length) {
          activeSubjectIndex = 0;
        }
        
        // Now fetch students with proper subject filtering
        await fetchClassStudents();
        await fetchGradingConfiguration();
      } else {
        // No subjects found for this teacher in this section
        error = 'No subjects found for this section';
        loading = false;
      }
    }
  });

  // Cleanup on component destruction
  onDestroy(() => {
    isDestroyed = true;
    loading = false;
    
    // Clear the verification check interval
    if (verificationCheckInterval) {
      clearInterval(verificationCheckInterval);
      verificationCheckInterval = null;
    }
  });
</script>

<svelte:window on:click={handleClickOutside} />

<div class="class-management-container">
  <!-- Header Section -->
  <div class="classlist-page-header">
    <div class="header-content">
      <div class="header-navigation">
        <button class="back-button" onclick={() => onBackToClassManagement && onBackToClassManagement()}>
          <span class="material-symbols-outlined">arrow_back</span>
          <span>Back to Class Management</span>
        </button>
      </div>
      <h1 class="classlist-page-title">Class Grading Sheet</h1>
      <p class="classlist-page-subtitle">{classInfo.section} • {classInfo.subject} • {classInfo.quarter}</p>
    </div>
    
    <!-- Subject Tabs -->
    {#if sectionData?.subjects && sectionData.subjects.length > 1}
      <div class="subject-tab-navigation">
        {#each sectionData.subjects as subject, index}
          <button 
            class="subject-tab-button" 
            class:active={activeSubjectIndex === index}
            onclick={() => setActiveSubject(index)}
          >
            <span class="material-symbols-outlined">book</span>
            {subject.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Grading Configuration Section -->
  <div class="grading-config-section">
    <div class="config-header">
      <h2 class="config-title">Grading Configuration</h2>
      <div class="classlist-quarter-selector-container">
        <div class="classlist-quarter-dropdown" class:open={isQuarterDropdownOpen}>
          <button
            type="button"
            class="classlist-quarter-select-button"
            class:selected={currentQuarter}
            onclick={toggleQuarterDropdown}
            id="classlist-quarter-select"
          >
            {#if selectedQuarterObj}
              <div class="classlist-quarter-selected-option">
                <span class="material-symbols-outlined classlist-quarter-option-icon">{selectedQuarterObj.icon}</span>
                <div class="classlist-quarter-option-content">
                  <span class="classlist-quarter-option-name">{selectedQuarterObj.name}</span>
                </div>
              </div>
            {:else}
              <span class="classlist-quarter-placeholder">Select quarter</span>
            {/if}
            <span class="material-symbols-outlined classlist-quarter-dropdown-arrow">expand_more</span>
          </button>
          <div class="classlist-quarter-dropdown-menu">
            {#each quarterOptions as quarter (quarter.id)}
              <button
                type="button"
                class="classlist-quarter-dropdown-option"
                class:selected={currentQuarter === quarter.id}
                onclick={() => selectQuarter(quarter)}
              >
                <span class="material-symbols-outlined classlist-quarter-option-icon">{quarter.icon}</span>
                <div class="classlist-quarter-option-content">
                  <span class="classlist-quarter-option-name">{quarter.name}</span>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>
    <div class="config-grid">
      <!-- Written Work Configuration -->
      <div class="config-item">
        <div class="config-label">Written Work ({Math.round(gradingConfig.writtenWork.weight * 100)}%)</div>
        <div class="classlist-column-controls">
          <div class="classlist-column-count">
            <span class="classlist-column-text">
              {#if loading}
                Loading...
              {:else}
                {gradingConfig.writtenWork.count} Column{gradingConfig.writtenWork.count !== 1 ? 's' : ''}
              {/if}
            </span>
          </div>
          <div class="classlist-action-buttons">
            <button 
              type="button"
              class="classlist-add-column-button"
              onclick={() => addColumn('writtenWork')}
              disabled={gradingConfig.writtenWork.count >= 10 || addingColumn || hasVerifiedGrades()}
              title={hasVerifiedGrades() ? "Cannot add columns when grades are verified" : "Add Column"}
            >
              <span class="material-symbols-outlined">add</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Performance Tasks Configuration -->
      <div class="config-item">
        <div class="config-label">Performance Tasks ({Math.round(gradingConfig.performanceTasks.weight * 100)}%)</div>
        <div class="classlist-column-controls">
          <div class="classlist-column-count">
            <span class="classlist-column-text">
              {#if loading}
                Loading...
              {:else}
                {gradingConfig.performanceTasks.count} Column{gradingConfig.performanceTasks.count !== 1 ? 's' : ''}
              {/if}
            </span>
          </div>
          <div class="classlist-action-buttons">
            <button 
              type="button"
              class="classlist-add-column-button"
              onclick={() => addColumn('performanceTasks')}
              disabled={gradingConfig.performanceTasks.count >= 10 || addingColumn || hasVerifiedGrades()}
              title={hasVerifiedGrades() ? "Cannot add columns when grades are verified" : "Add Column"}
            >
              <span class="material-symbols-outlined">add</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Quarterly Assessment Configuration -->
      <div class="config-item">
        <div class="config-label">Quarterly Assessment ({Math.round(gradingConfig.quarterlyAssessment.weight * 100)}%)</div>
        <div class="classlist-column-controls">
          <div class="classlist-column-count">
            <span class="classlist-column-text">
              {#if loading}
                Loading...
              {:else}
                {gradingConfig.quarterlyAssessment.count} Column{gradingConfig.quarterlyAssessment.count !== 1 ? 's' : ''}
              {/if}
            </span>
          </div>
          <div class="classlist-action-buttons">
            <button 
              type="button"
              class="classlist-add-column-button"
              onclick={() => addColumn('quarterlyAssessment')}
              disabled={gradingConfig.quarterlyAssessment.count >= 10 || addingColumn || hasVerifiedGrades()}
              title={hasVerifiedGrades() ? "Cannot add columns when grades are verified" : "Add Column"}
            >
              <span class="material-symbols-outlined">add</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Grading Spreadsheet Section -->
    {#if loading}
    <div class="loading-container">
      <div class="system-loader"></div>
      <p>Loading class data...</p>
    </div>
    {:else if error}
    <div class="error-container">
      <div class="error-icon">
        <span class="material-symbols-outlined">error</span>
      </div>
      <p class="error-message">Error: {error}</p>
      <button class="retry-button" onclick={fetchClassStudents}>
        <span class="material-symbols-outlined">refresh</span>
        Retry
      </button>
    </div>
    {:else if students.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <span class="material-symbols-outlined">school</span>
      </div>
      <h3>No Students Found</h3>
      <p>This section doesn't have any enrolled students yet.</p>
    </div>
    {:else}
      <GradingSpreadsheet 
        bind:this={gradingSpreadsheetRef}
        bind:students 
        bind:gradingConfig 
        sectionId={selectedClass?.sectionId}
        subjectId={activeSubject?.id}
        gradingPeriodId={currentQuarter}
      />
    {/if}
  </div>
</div>

<!-- Toast Notification -->
{#if showToast}
  <Toast message={toastMessage} type={toastType} onClose={() => showToast = false} />
{/if}
