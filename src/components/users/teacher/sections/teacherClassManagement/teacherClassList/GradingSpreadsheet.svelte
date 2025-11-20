<script>
  import { onMount, untrack } from 'svelte';
  import * as XLSX from 'xlsx';
  import { toastStore } from '../../../../../common/js/toastStore.js';
  import { modalStore } from '../../../../../common/js/modalStore.js';
  import { authenticatedFetch } from '../../../../../../routes/api/helper/api-helper.js';
  import { authStore } from '../../../../../login/js/auth.js';
  import './GradingSpreadsheet.css';

  // Props
  let {
    students = [],
    sectionId,
    subjectId,
    gradingPeriodId = 1,
    gradingConfig = {
      writtenWork: {
        count: 3,
        weight: 0.30,
        totals: [] // Array to store individual column totals
      },
      performanceTasks: {
        count: 3,
        weight: 0.50,
        totals: [] // Array to store individual column totals
      },
      quarterlyAssessment: {
        count: 1,
        weight: 0.20,
        totals: [] // Array to store individual column totals
      }
    }
  } = $props();

  // State for save functionality
  let isSaving = $state(false);
  let isSavingFinalGrades = $state(false); // Separate state for final grades saving
  let saveMessage = $state('');
  let saveSuccess = $state(false);
  let autoSaveTimeout = null; // For debounced auto-save on data changes

  // New state for tracking data changes and save status
  let hasUnsavedChanges = $state(false);
  let isDataSaved = $state(true); // Start as saved since no changes initially
  let originalData = $state(null); // Store original data for comparison
  // svelte-ignore non_reactive_update (DOM reference, not reactive state)
  let spreadsheetContainer;
  let selectedCell = $state(null);
  let isEditing = $state(false);
  let editValue = $state('');

  // Loading state for the entire grading spreadsheet
  let isSpreadsheetLoading = $state(true);
  let justStartedEditing = $state(false);
  let copiedData = $state(null);
  let invalidCells = $state(new Set()); // Track cells with invalid input that were converted to 0

  // Initialize spreadsheet data
  let spreadsheetData = $state([]);
  let headers = $state([]);

  // Initialize spreadsheet data
  function formatScore(score) {
    if (score === null || score === undefined || score === '') return '0';
    const num = parseFloat(score);
    if (isNaN(num)) return score;
    // Remove trailing zeros and unnecessary decimal point
    return num % 1 === 0 ? num.toString() : num.toString();
  }

  // Function to create a deep copy of student data for comparison
  function createDataSnapshot() {
    return JSON.parse(JSON.stringify(students.map(student => ({
      id: student.id,
      writtenWork: Array.isArray(student.writtenWork) ? [...student.writtenWork] : [],
      performanceTasks: Array.isArray(student.performanceTasks) ? [...student.performanceTasks] : [],
      quarterlyAssessment: Array.isArray(student.quarterlyAssessment) ? [...student.quarterlyAssessment] : []
    }))));
  }

  // Function to check if data has changed
  function checkForDataChanges() {
    if (!originalData) return false;

    const currentData = createDataSnapshot();
    const hasChanges = JSON.stringify(currentData) !== JSON.stringify(originalData);

    hasUnsavedChanges = hasChanges;
    isDataSaved = !hasChanges;

    return hasChanges;
  }

  function initializeSpreadsheetData() {
    const headers = ['Student ID', 'Student Name'];


    // Add Written Work columns
    for (let i = 1; i <= gradingConfig.writtenWork.count; i++) {
      headers.push(getColumnHeaderWithTotal('writtenWork', i - 1));
    }
    headers.push('WW Avg');

    // Add Performance Tasks columns
    for (let i = 1; i <= gradingConfig.performanceTasks.count; i++) {
      headers.push(getColumnHeaderWithTotal('performanceTasks', i - 1));
    }
    headers.push('PT Avg');

    // Add Quarterly Assessment columns
    for (let i = 1; i <= gradingConfig.quarterlyAssessment.count; i++) {
      headers.push(getColumnHeaderWithTotal('quarterlyAssessment', i - 1));
    }
    headers.push('QA Avg');
    headers.push('Final Grade');

    spreadsheetData = [headers];

    // Add student data rows
    students.forEach(student => {
      // Add defensive check for student object and required properties
      if (!student || !student.id || !student.name) {
        console.warn('Invalid student data:', student);
        return;
      }
      
      const row = [student.id, student.name];

      // Written Work scores - ensure array exists
      const writtenWork = student.writtenWork || [];
      for (let i = 0; i < gradingConfig.writtenWork.count; i++) {
        row.push(formatScore(writtenWork[i]));
      }
      row.push(calculateAverage(writtenWork, gradingConfig.writtenWork.totals, 'writtenWork'));

      // Performance Tasks scores - ensure array exists
      const performanceTasks = student.performanceTasks || [];
      for (let i = 0; i < gradingConfig.performanceTasks.count; i++) {
        row.push(formatScore(performanceTasks[i]));
      }
      row.push(calculateAverage(performanceTasks, gradingConfig.performanceTasks.totals, 'performanceTasks'));

      // Quarterly Assessment scores - ensure array exists
      const quarterlyAssessment = student.quarterlyAssessment || [];
      for (let i = 0; i < gradingConfig.quarterlyAssessment.count; i++) {
        row.push(formatScore(quarterlyAssessment[i]));
      }
      row.push(calculateAverage(quarterlyAssessment, gradingConfig.quarterlyAssessment.totals, 'quarterlyAssessment'));

      // Final Grade
      row.push(calculateFinalGrade(student));

      spreadsheetData.push(row);
    });

    // Reset original data snapshot when subject changes
    originalData = createDataSnapshot();
    // Don't assume data is saved on initialization - let user decide when to save
    isDataSaved = false;
    hasUnsavedChanges = false;

    // Set loading to false after initialization
    isSpreadsheetLoading = false;
  }

  function calculateAverage(scores, totals = null, assessmentType = null) {
    // Add defensive check for undefined/null scores
    if (!scores || !Array.isArray(scores)) {
      return '';
    }
    
    // Filter out only null, undefined, and empty string values - keep zeros!
    const validScores = scores.filter(score => score !== null && score !== undefined && score !== '');
    if (validScores.length === 0) return '';

    let sum = 0;

    // If totals are provided, calculate percentage-based average
    if (totals && totals.length > 0) {
      let percentageSum = 0;
      let validPercentageCount = 0;

      // Only iterate through the number of totals we have, not all scores
      const maxIndex = Math.min(scores.length, totals.length);

      for (let i = 0; i < maxIndex; i++) {
        const score = scores[i];
        // Include zero values in the calculation - only exclude null, undefined, and empty string
        if (score !== null && score !== undefined && score !== '') {
          const scoreValue = parseFloat(score);
          const total = totals[i];
          if (total && total > 0) { // Only calculate if we have a valid total
            const percentage = (scoreValue / total) * 100;
            percentageSum += percentage;
            validPercentageCount++;
            
          }
        }
      }

      

      if (validPercentageCount === 0) return '';
      const average = Math.round((percentageSum / validPercentageCount) * 10) / 10;
      return formatScore(average);
    } else {
      // Original calculation for backward compatibility
      sum = validScores.reduce((acc, score) => acc + parseFloat(score), 0);
      const average = Math.round((sum / validScores.length) * 10) / 10;
      return formatScore(average);
    }
  }

  function calculateFinalGrade(student) {
    // Add defensive check for student object
    if (!student) return '';
    
    const wwAvg = calculateAverage(student.writtenWork, gradingConfig.writtenWork.totals, 'writtenWork');
    const ptAvg = calculateAverage(student.performanceTasks, gradingConfig.performanceTasks.totals, 'performanceTasks');
    const qaAvg = calculateAverage(student.quarterlyAssessment, gradingConfig.quarterlyAssessment.totals, 'quarterlyAssessment');

    if (wwAvg === '' || ptAvg === '' || qaAvg === '') return '';

    // Parse the formatted averages back to numbers for calculation
    const wwNum = parseFloat(wwAvg) || 0;
    const ptNum = parseFloat(ptAvg) || 0;
    const qaNum = parseFloat(qaAvg) || 0;

    const finalGrade = (wwNum * gradingConfig.writtenWork.weight) +
                      (ptNum * gradingConfig.performanceTasks.weight) +
                      (qaNum * gradingConfig.quarterlyAssessment.weight);

    const roundedGrade = Math.round(finalGrade * 10) / 10;
    return formatScore(roundedGrade);
  }

  function handleCellClick(rowIndex, colIndex, event) {
    if (colIndex < 2) return; // Don't allow editing of student info columns

    // Check if this student's grades are verified by the adviser
    const studentIndex = rowIndex - 1;
    const student = students[studentIndex];
    
    
    if (student && student.isVerified) {
      // Show a toast message to inform the teacher
      toastStore.warning('This student\'s grades have been verified by the adviser and cannot be edited.');
      return;
    }

    selectedCell = { row: rowIndex, col: colIndex };

    // Don't automatically start editing on click - let user navigate first
    isEditing = false;
  }

  function handleGlobalKeydown(event) {
    if (!selectedCell) return;

    // Don't handle global keydown when editing - let the input handler take care of it
    if (isEditing) return;

    const { row, col } = selectedCell;

    // Handle arrow key navigation
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      navigateCell(event.key);
      return;
    }

    // Handle Enter key (move down like Excel)
    if (event.key === 'Enter') {
      event.preventDefault();
      navigateCell('ArrowDown');
      return;
    }

    // Handle Tab key (move right)
    if (event.key === 'Tab') {
      event.preventDefault();
      navigateCell(event.shiftKey ? 'ArrowLeft' : 'ArrowRight');
      return;
    }

    // Only handle typing to start editing
    if (/^[0-9.]$/.test(event.key) && !isCalculatedColumn(col) && col > 1) {
      // Check if this student's grades are verified by the adviser
      const studentIndex = row - 1;
      const student = students[studentIndex];
      
      
      if (student && student.isVerified) {
        toastStore.warning('This student\'s grades have been verified by the adviser and cannot be edited.');
        return;
      }
      
      event.preventDefault();
      isEditing = true;
      editValue = event.key;
      justStartedEditing = false; // First character already entered
    } else if (event.key.length === 1 && !isCalculatedColumn(col) && col > 1) {
      // Check if this student's grades are verified by the adviser
      const studentIndex = row - 1;
      const student = students[studentIndex];
      
      
      if (student && student.isVerified) {
        toastStore.warning('This student\'s grades have been verified by the adviser and cannot be edited.');
        return;
      }
      
      event.preventDefault();
      isEditing = true;
      editValue = event.key;
      justStartedEditing = false; // First character already entered
    }
  }

  // Function to navigate between cells
  function navigateCell(direction) {
    if (!selectedCell || !spreadsheetData.length) return;

    const { row, col } = selectedCell;
    const maxRow = spreadsheetData.length - 1; // -1 because first row is headers
    const maxCol = spreadsheetData[0].length - 1;

    let newRow = row;
    let newCol = col;

    switch (direction) {
      case 'ArrowUp':
        newRow = Math.max(1, row - 1); // Don't go above first data row
        break;
      case 'ArrowDown':
        newRow = Math.min(maxRow, row + 1);
        break;
      case 'ArrowLeft':
        newCol = Math.max(0, col - 1);
        break;
      case 'ArrowRight':
        newCol = Math.min(maxCol, col + 1);
        break;
    }

    // Update selected cell
    selectedCell = { row: newRow, col: newCol };

    // Scroll the cell into view if needed
    scrollCellIntoView(newRow, newCol);
  }

  // Function to scroll cell into view
  function scrollCellIntoView(row, col) {
    if (!spreadsheetContainer) return;

    // Find the cell element
    const cellElement = spreadsheetContainer.querySelector(
      `tbody tr:nth-child(${row}) td:nth-child(${col + 1})`
    );

    if (cellElement) {
      cellElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }

  function isCalculatedColumn(colIndex) {
    const headers = spreadsheetData[0];
    const header = headers[colIndex];
    return header?.includes('Avg') || header === 'Final Grade';
  }

  // Check if column is an assessment column (clickable for total scores)
  function isAssessmentColumn(colIndex) {
    return getColumnMapping(colIndex) !== null;
  }

  function getColumnType(colIndex) {
    const headers = spreadsheetData[0];
    const header = headers[colIndex];

    if (colIndex < 2) return 'spreadsheet-student-info';
    if (header === 'Final Grade') return 'calculated';
    if (header?.includes('Avg')) return 'calculated';
    if (header?.startsWith('WW')) return 'written-work';
    if (header?.startsWith('PT')) return 'performance-task';
    if (header?.startsWith('QA')) return 'quarterly-assessment';

    return 'default';
  }

  // Handle header click - open edit modal for assessment columns
  function handleHeaderClick(colIndex, event) {
    event.preventDefault();
    event.stopPropagation();

    if (isAssessmentColumn(colIndex)) {
      editColumn(colIndex);
    }
  }

  // Get assessment type and column index from spreadsheet column index
  function getColumnMapping(colIndex) {
    let currentIndex = 2; // Start after Student ID and Student Name

    // Check Written Work columns
    for (let i = 0; i < gradingConfig.writtenWork.count; i++) {
      if (currentIndex === colIndex) {
        return { assessmentType: 'writtenWork', columnIndex: i };
      }
      currentIndex++;
    }
    currentIndex++; // Skip WW Avg

    // Check Performance Tasks columns
    for (let i = 0; i < gradingConfig.performanceTasks.count; i++) {
      if (currentIndex === colIndex) {
        return { assessmentType: 'performanceTasks', columnIndex: i };
      }
      currentIndex++;
    }
    currentIndex++; // Skip PT Avg

    // Check Quarterly Assessment columns
    for (let i = 0; i < gradingConfig.quarterlyAssessment.count; i++) {
      if (currentIndex === colIndex) {
        return { assessmentType: 'quarterlyAssessment', columnIndex: i };
      }
      currentIndex++;
    }

    return null; // Not an assessment column
  }

  // Update total scores and recalculate
  async function updateTotalScores(assessmentType, columnIndex, newTotal) {
    // Check if gradingConfig and assessmentType exist
    if (!gradingConfig || !gradingConfig[assessmentType]) {
      console.error('Invalid gradingConfig or assessmentType:', assessmentType);
      return;
    }

    // Initialize totals array if it doesn't exist
    if (!gradingConfig[assessmentType].totals) {
      gradingConfig[assessmentType].totals = [];
    }

    // Get the grade item ID for this column
    const gradeItemId = gradingConfig[assessmentType].gradeItemIds?.[columnIndex];

    if (gradeItemId) {
      try {
        // Create user info object for authentication
        const userInfo = {
          id: $authStore.userData.id,
          name: $authStore.userData.name,
          account_number: $authStore.userData.accountNumber,
          account_type: $authStore.userData.account_type || $authStore.userData.accountType
        };

        // Call API to update the total score in the database
        const response = await fetch('/api/grades/grade-items', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-info': JSON.stringify(userInfo)
          },
          body: JSON.stringify({
            grade_item_id: gradeItemId,
            total_score: newTotal
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to update total score:', errorData);
          toastStore.error('Failed to update total score in database');
          return;
        }

        const result = await response.json();
        toastStore.success('Total score updated successfully');
      } catch (error) {
        toastStore.error('Failed to update total score');
        return;
      }
    }

    // Update the specific column total
    gradingConfig[assessmentType].totals[columnIndex] = newTotal;

    // Trigger reactivity
    gradingConfig = { ...gradingConfig };

    // Recalculate spreadsheet data
    initializeSpreadsheetData();
  }

  // Handle column rename
  async function handleColumnRename(assessmentType, columnIndex, newName) {
    // Check if gradingConfig and assessmentType exist
    if (!gradingConfig || !gradingConfig[assessmentType]) {
      console.error('Invalid gradingConfig or assessmentType:', assessmentType);
      toastStore.error('Cannot rename column. Invalid configuration.');
      return;
    }

    // Get the grade item ID for this column
    const gradeItemId = gradingConfig[assessmentType].gradeItemIds?.[columnIndex];

    if (gradeItemId) {
      try {
        // Create user info object for authentication
        const userInfo = {
          id: $authStore.userData.id,
          name: $authStore.userData.name,
          account_number: $authStore.userData.accountNumber,
          account_type: $authStore.userData.account_type || $authStore.userData.accountType
        };

        // Call API to update the name in the database
        const response = await fetch('/api/grades/grade-items', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-info': JSON.stringify(userInfo)
          },
          body: JSON.stringify({
            grade_item_id: gradeItemId,
            name: newName
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to update column name:', errorData);
          toastStore.error('Failed to update column name in database');
          return;
        }

        const result = await response.json();
      } catch (error) {
        toastStore.error('Failed to update column name');
        return;
      }
    }

    // Initialize column names array if it doesn't exist
    if (!gradingConfig[assessmentType].columnNames) {
      gradingConfig[assessmentType].columnNames = [];
    }

    // Update the specific column name
    gradingConfig[assessmentType].columnNames[columnIndex] = newName;

    // Trigger reactivity
    gradingConfig = { ...gradingConfig };

    // Recalculate spreadsheet data to reflect new name
    initializeSpreadsheetData();

    toastStore.success(`Column renamed to "${newName}"`);
  }

  // Handle column removal
  async function handleColumnRemove(assessmentType, columnIndex) {
    // Check if gradingConfig and assessmentType exist
    if (!gradingConfig || !gradingConfig[assessmentType]) {
      console.error('Invalid gradingConfig or assessmentType:', assessmentType);
      toastStore.error('Cannot remove column. Invalid configuration.');
      return;
    }

    // Check if we can remove (must have at least 1 column)
    if (gradingConfig[assessmentType].count <= 1) {
      toastStore.error('Cannot remove column. At least one column is required.');
      return;
    }

    try {
      // Map category names to category IDs
      const categoryMap = {
        'writtenWork': 1,
        'performanceTasks': 2,
        'quarterlyAssessment': 3
      };

      const categoryId = categoryMap[assessmentType];
      if (!categoryId) {
        console.error('Invalid assessment type:', assessmentType);
        toastStore.error('Invalid assessment type.');
        return;
      }

      // Get the specific grade item ID for the column being removed
      const gradeItemId = gradingConfig[assessmentType].gradeItemIds?.[columnIndex];
      if (!gradeItemId) {
        console.error('No grade item ID found for column:', columnIndex);
        toastStore.error('Cannot identify column to remove.');
        return;
      }

      // Create user info object for authentication
      const userInfo = {
        id: $authStore.userData.id,
        name: $authStore.userData.name,
        account_number: $authStore.userData.accountNumber,
        account_type: $authStore.userData.account_type || $authStore.userData.accountType
      };

      // Call API to remove grade item from database
      const response = await fetch('/api/grades/grade-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-info': JSON.stringify(userInfo)
        },
        body: JSON.stringify({
          action: 'remove',
          section_id: sectionId,
          subject_id: subjectId,
          grading_period_id: gradingPeriodId,
          category_id: categoryId,
          grade_item_id: gradeItemId // Send specific grade item ID
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to remove grade item:', errorData.error);
        toastStore.error('Failed to remove column from database: ' + errorData.error);
        return;
      }

      const result = await response.json();

      // Update UI only after successful database operation
      // Decrease column count
      gradingConfig[assessmentType].count -= 1;

      // Remove from totals array if it exists
      if (gradingConfig[assessmentType].totals) {
        gradingConfig[assessmentType].totals.splice(columnIndex, 1);
      }

      // Remove from column names array if it exists
      if (gradingConfig[assessmentType].columnNames) {
        gradingConfig[assessmentType].columnNames.splice(columnIndex, 1);
      }

      // Remove from column positions array if it exists
      if (gradingConfig[assessmentType].columnPositions) {
        gradingConfig[assessmentType].columnPositions.splice(columnIndex, 1);
      }

      // Remove from grade item IDs array if it exists
      if (gradingConfig[assessmentType].gradeItemIds) {
        gradingConfig[assessmentType].gradeItemIds.splice(columnIndex, 1);
      }

      // Update student data to remove the column
      students = students.map(student => {
        const newStudent = { ...student };
        if (newStudent[assessmentType] && Array.isArray(newStudent[assessmentType])) {
          newStudent[assessmentType].splice(columnIndex, 1);
        }
        return newStudent;
      });

      // Trigger reactivity
      gradingConfig = { ...gradingConfig };

      toastStore.success('Column removed successfully');
    } catch (error) {
      console.error('Error removing column:', error);
      toastStore.error('Failed to remove column: ' + error.message);
    }
  }

  // Get existing column names for validation
  function getExistingColumnNames(assessmentType) {
    // Check if gradingConfig and assessmentType exist
    if (!gradingConfig || !assessmentType || !gradingConfig[assessmentType]) {
      return [];
    }

    const names = [];

    // Add default column names
    for (let i = 1; i <= gradingConfig[assessmentType].count; i++) {
      const defaultName = getColumnName(assessmentType, i - 1);
      names.push(defaultName);
    }

    // Add custom column names if they exist
    if (gradingConfig[assessmentType].columnNames) {
      gradingConfig[assessmentType].columnNames.forEach((name, index) => {
        if (name && name.trim()) {
          names[index] = name.trim();
        }
      });
    }

    return names;
  }

  // Get column name with total score (for headers)
  function getColumnHeaderWithTotal(assessmentType, columnIndex) {
    const columnName = getColumnName(assessmentType, columnIndex);
    const totalScore = gradingConfig[assessmentType].totals[columnIndex] || 100;
    return `${columnName} - ${totalScore}`;
  }

  // Get column name (custom or default)
  function getColumnName(assessmentType, columnIndex) {
    // Check if custom name exists
    if (gradingConfig[assessmentType].columnNames &&
        gradingConfig[assessmentType].columnNames[columnIndex]) {
      return gradingConfig[assessmentType].columnNames[columnIndex];
    }

    // Return default name using original position numbers
    const prefix = assessmentType === 'writtenWork' ? 'WW' :
                   assessmentType === 'performanceTasks' ? 'PT' : 'QA';

    // Use columnPositions if available, otherwise fall back to sequential numbering
    if (gradingConfig[assessmentType].columnPositions &&
        gradingConfig[assessmentType].columnPositions[columnIndex] !== undefined) {
      return `${prefix}${gradingConfig[assessmentType].columnPositions[columnIndex]}`;
    }

    return `${prefix}${columnIndex + 1}`;
  }

  // Check if column can be removed
  function canRemoveColumn(assessmentType) {
    // Check if gradingConfig and assessmentType exist
    if (!gradingConfig || !assessmentType || !gradingConfig[assessmentType]) {
      return false;
    }
    return gradingConfig[assessmentType].count > 1;
  }

  // Check if any grades are verified (locked)
  function hasVerifiedGrades() {
    return students.some(student => student.isVerified || student.verified);
  }

  // Helper function to get current total for a specific column
  function getTotalForColumn(assessmentType, columnIndex) {
    // Check if gradingConfig and assessmentType exist
    if (!gradingConfig || !gradingConfig[assessmentType]) {
      return '';
    }

    if (!gradingConfig[assessmentType].totals) {
      return '';
    }
    return gradingConfig[assessmentType].totals[columnIndex] || '';
  }

  function handleCellInput(rowIndex, colIndex, event) {
    const value = event.target.value;
    const numValue = parseFloat(value);

    // Validate input is a number
    if (value !== '' && (isNaN(numValue) || numValue < 0)) {
      event.target.value = spreadsheetData[rowIndex][colIndex] || '';
      return;
    }

    // Get column type and validate against total if applicable
    const headers = spreadsheetData[0];
    const header = headers[colIndex];

    // Check if this is a raw score column and validate against total
    if (header && !header.includes('Avg') && header !== 'Final Grade' && colIndex > 1) {
      let assessmentType = null;
      let assessmentIndex = -1;

      if (header.startsWith('WW')) {
        assessmentType = 'Written Work';
        assessmentIndex = parseInt(header.substring(2)) - 1;
      } else if (header.startsWith('PT')) {
        assessmentType = 'Performance Task';
        assessmentIndex = parseInt(header.substring(2)) - 1;
      } else if (header.startsWith('QA')) {
        assessmentType = 'Quarterly Assessment';
        assessmentIndex = parseInt(header.substring(2)) - 1;
      }

      // Validate against total score
      if (assessmentType && assessmentIndex >= 0) {
        const totals = gradingConfig[assessmentType]?.totals;
        const maxScore = totals?.[assessmentIndex];

        if (maxScore && numValue > maxScore) {
          // Show error and revert
           // Note: Toast functionality would need to be passed from parent component
           alert(`Score cannot exceed ${maxScore} points for ${header}`);
           event.target.value = spreadsheetData[rowIndex + 1][colIndex] || '';
           return;
        }
      }
    }

    // Update the data
    spreadsheetData[rowIndex][colIndex] = value;

    // Update the original student data
    updateStudentData(rowIndex, colIndex, value);

    // Recalculate averages and final grades
    recalculateRow(rowIndex);
  }

  function updateStudentData(rowIndex, colIndex, value) {
    const studentIndex = rowIndex - 1; // Subtract 1 for header row
    if (studentIndex < 0 || studentIndex >= students.length) return;

    const headers = spreadsheetData[0];
    const header = headers[colIndex];

    // Helper function to parse value and return 0 for invalid input
    const parseValueOrZero = (val) => {
      if (!val || val.trim() === '') return null;
      const parsed = parseFloat(val);

      // Get the maximum score for this column
      let maxScore = null;
      if (header?.startsWith('WW')) {
        const columnNumber = parseInt(header.replace('WW', ''));
        const columnIndex = gradingConfig.writtenWork.columnPositions?.indexOf(columnNumber) ?? (columnNumber - 1);
        maxScore = gradingConfig.writtenWork.totals?.[columnIndex];
      } else if (header?.startsWith('PT')) {
        const columnNumber = parseInt(header.replace('PT', ''));
        const columnIndex = gradingConfig.performanceTasks.columnPositions?.indexOf(columnNumber) ?? (columnNumber - 1);
        maxScore = gradingConfig.performanceTasks.totals?.[columnIndex];
      } else if (header?.startsWith('QA')) {
        const columnNumber = parseInt(header.replace('QA', ''));
        const columnIndex = gradingConfig.quarterlyAssessment.columnPositions?.indexOf(columnNumber) ?? (columnNumber - 1);
        maxScore = gradingConfig.quarterlyAssessment.totals?.[columnIndex];
      }

      // Validate input: return 0 if invalid, negative, or exceeds maximum
      return isNaN(parsed) || parsed < 0 || (maxScore && parsed > maxScore) ? 0 : parsed;
    };

    if (header?.startsWith('WW') && !header.includes('Avg')) {
      // Find the actual array index by matching the header with column names
      const columnNumber = parseInt(header.replace('WW', ''));
      const wwIndex = gradingConfig.writtenWork.columnPositions?.indexOf(columnNumber) ?? (columnNumber - 1);
      if (wwIndex >= 0 && wwIndex < students[studentIndex].writtenWork.length) {
        students[studentIndex].writtenWork[wwIndex] = parseValueOrZero(value);
      }
    } else if (header?.startsWith('PT') && !header.includes('Avg')) {
      // Find the actual array index by matching the header with column names
      const columnNumber = parseInt(header.replace('PT', ''));
      const ptIndex = gradingConfig.performanceTasks.columnPositions?.indexOf(columnNumber) ?? (columnNumber - 1);
      if (ptIndex >= 0 && ptIndex < students[studentIndex].performanceTasks.length) {
        students[studentIndex].performanceTasks[ptIndex] = parseValueOrZero(value);
      }
    } else if (header?.startsWith('QA') && !header.includes('Avg')) {
      // Find the actual array index by matching the header with column names
      const columnNumber = parseInt(header.replace('QA', ''));
      const qaIndex = gradingConfig.quarterlyAssessment.columnPositions?.indexOf(columnNumber) ?? (columnNumber - 1);
      if (qaIndex >= 0 && qaIndex < students[studentIndex].quarterlyAssessment.length) {
        students[studentIndex].quarterlyAssessment[qaIndex] = parseValueOrZero(value);
      }
    }
  }

  function recalculateRow(rowIndex) {
    if (rowIndex === 0) return; // Skip header row

    const studentIndex = rowIndex - 1;
    const student = students[studentIndex];

    // Find column indices for averages
    const headers = spreadsheetData[0];
    const wwAvgIndex = headers.findIndex(h => h === 'WW Avg');
    const ptAvgIndex = headers.findIndex(h => h === 'PT Avg');
    const qaAvgIndex = headers.findIndex(h => h === 'QA Avg');
    const finalGradeIndex = headers.findIndex(h => h === 'Final Grade');

    // Update averages
    if (wwAvgIndex !== -1) {
      spreadsheetData[rowIndex][wwAvgIndex] = calculateAverage(student.writtenWork, gradingConfig.writtenWork.totals, 'writtenWork');
    }
    if (ptAvgIndex !== -1) {
      spreadsheetData[rowIndex][ptAvgIndex] = calculateAverage(student.performanceTasks, gradingConfig.performanceTasks.totals, 'performanceTasks');
    }
    if (qaAvgIndex !== -1) {
      spreadsheetData[rowIndex][qaAvgIndex] = calculateAverage(student.quarterlyAssessment, gradingConfig.quarterlyAssessment.totals, 'quarterlyAssessment');
    }
    if (finalGradeIndex !== -1) {
      spreadsheetData[rowIndex][finalGradeIndex] = calculateFinalGrade(student);
    }

    // Trigger reactivity
    spreadsheetData = [...spreadsheetData];
  }

  function updateSpreadsheetData() {
    if (!selectedCell || selectedCell.row === 0) return;

    const { row, col } = selectedCell;
    const studentIndex = row - 1;
    const student = students[studentIndex];

    if (!student) return;

    // Get the column mapping to determine which assessment type and index
    const columnMapping = getColumnMapping(col);
    if (!columnMapping) return;

    const { assessmentType, columnIndex } = columnMapping;

    // Parse and validate the input
    let value = editValue.trim();
    let numericValue = null;
    let isValid = true;
    let errorMessage = '';

    if (value !== '') {
      numericValue = parseFloat(value);
      
      // Check for invalid number format or negative values
      if (isNaN(numericValue) || numericValue < 0) {
        numericValue = 0;
        isValid = false;
        errorMessage = isNaN(parseFloat(value)) ? 'Invalid input. Only numbers are allowed.' : 'Negative scores are not allowed.';
      } else {
        // Check if score exceeds total score for this column
        const totalScore = gradingConfig[assessmentType].totals?.[columnIndex];
        if (totalScore && numericValue > totalScore) {
          numericValue = 0;
          isValid = false;
          errorMessage = `Score cannot exceed the total score of ${totalScore}.`;
        }
      }

      if (!isValid) {
        // Show error toast
        toastStore.error(errorMessage);
        
        // Mark cell as invalid
        invalidCells.add(`${row}-${col}`);

        // Remove invalid marking after 3 seconds
        setTimeout(() => {
          invalidCells.delete(`${row}-${col}`);
          invalidCells = new Set(invalidCells); // Trigger reactivity
        }, 3000);
      } else {
        // Valid input - remove from invalid cells if it was there
        invalidCells.delete(`${row}-${col}`);
      }
    } else {
      // Empty value is valid (represents no score)
      numericValue = null;
      invalidCells.delete(`${row}-${col}`);
    }

    // Update the student's data
    student[assessmentType][columnIndex] = numericValue;

    // Trigger reactivity
    students = [...students];

    // Reinitialize spreadsheet to recalculate averages and final grades
    initializeSpreadsheetData();

    // Check for data changes after update
    checkForDataChanges();

    // Trigger debounced auto-save on data change - DISABLED to prevent unlocking verified grades
    // triggerDebouncedAutoSave();
  }

  function handleKeyDown(event, rowIndex, colIndex) {
    if (!selectedCell) return;

    // Handle navigation and editing when input is focused
    if (isEditing) {
      // Handle Enter key - save current value and move down
      if (event.key === 'Enter') {
        event.preventDefault();
        // Save the current value and get the current position
        const currentRow = selectedCell.row;
        const currentCol = selectedCell.col;
        updateSpreadsheetData();
        isEditing = false;
        // Use a timeout to ensure the spreadsheet has been updated before navigating
        setTimeout(() => {
          selectedCell = { row: currentRow, col: currentCol };
          navigateCell('ArrowDown');
        }, 0);
        return;
      }

      // Handle Tab key - save current value and move right/left
      if (event.key === 'Tab') {
        event.preventDefault();
        // Save the current value and get the current position
        const currentRow = selectedCell.row;
        const currentCol = selectedCell.col;
        updateSpreadsheetData();
        isEditing = false;
        // Use a timeout to ensure the spreadsheet has been updated before navigating
        setTimeout(() => {
          selectedCell = { row: currentRow, col: currentCol };
          navigateCell(event.shiftKey ? 'ArrowLeft' : 'ArrowRight');
        }, 0);
        return;
      }

      // Handle arrow keys - save current value and navigate
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
          event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        // Save the current value and get the current position
        const currentRow = selectedCell.row;
        const currentCol = selectedCell.col;
        updateSpreadsheetData();
        isEditing = false;
        // Use a timeout to ensure the spreadsheet has been updated before navigating
        setTimeout(() => {
          selectedCell = { row: currentRow, col: currentCol };
          navigateCell(event.key);
        }, 0);
        return;
      }

      // Handle Escape to exit editing mode without saving
      if (event.key === 'Escape') {
        event.preventDefault();
        isEditing = false;
        editValue = '';
        return;
      }
    }
  }

  // Auto-save function (silent save without UI feedback)
  async function autoSave() {
    if (isSaving || !students.length || !sectionId || !subjectId) {
      return;
    }

    try {
      // Prepare grades data for API
      const gradesData = students.map(student => ({
        student_id: student.account_number || student.accountNumber || student.id,
        writtenWork: student.writtenWork,
        performanceTasks: student.performanceTasks,
        quarterlyAssessment: student.quarterlyAssessment
      }));

      await authenticatedFetch('/api/grades/save', {
        method: 'POST',
        body: JSON.stringify({
          section_id: sectionId,
          subject_id: subjectId,
          grading_period_id: gradingPeriodId,
          grading_config: gradingConfig,
          grades: gradesData
        })
      });

      // Don't update save state after auto-save to keep manual save button available
      // The manual save button should remain enabled for explicit user action

    } catch (error) {
      // Silent auto-save errors - only log critical failures
      console.error('Auto-save failed:', error.message);
    }
  }

  // Debounced auto-save function (triggers auto-save after 3 seconds of inactivity)
  function triggerDebouncedAutoSave() {
    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Set new timeout for 3 seconds
    autoSaveTimeout = setTimeout(() => {
      autoSave();
    }, 3000);
  }

  // Manual save function (with UI feedback)
  // svelte-ignore non_reactive_update (Function declaration, not reactive state)
  async function saveGrades() {
    if (!sectionId || !subjectId) {
      toastStore.error('Missing section or subject information');
      return;
    }

    isSaving = true;
    saveMessage = '';
    saveSuccess = false;

    try {
      // Prepare grades data for API
      const gradesData = students.map(student => ({
        student_id: student.accountNumber || student.account_number || student.id,
        writtenWork: student.writtenWork,
        performanceTasks: student.performanceTasks,
        quarterlyAssessment: student.quarterlyAssessment
      }));

      const response = await authenticatedFetch('/api/grades/save', {
        method: 'POST',
        body: JSON.stringify({
          section_id: sectionId,
          subject_id: subjectId,
          grading_period_id: gradingPeriodId,
          grading_config: gradingConfig,
          grades: gradesData
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      saveSuccess = true;
      toastStore.success('Grades saved successfully');

      // Update save state after successful save
      originalData = createDataSnapshot();
      hasUnsavedChanges = false;
      isDataSaved = true;

      // Clear the message after 3 seconds
      setTimeout(() => {
        saveMessage = '';
      }, 3000);

    } catch (error) {
      console.error('Error saving grades:', error);
      saveSuccess = false;
      saveMessage = error.message || 'Failed to save grades';
      toastStore.error(saveMessage);

      // Clear the message after 5 seconds for errors
      setTimeout(() => {
        saveMessage = '';
      }, 5000);
    } finally {
      isSaving = false;
    }
  }

  // New function to save final grades to the final_grades table
  async function saveFinalGrades() {
    
    if (!sectionId || !subjectId) {
      toastStore.error('Missing section or subject information');
      return;
    }

    // Show confirmation modal first
    modalStore.confirm(
      'Send Grades to Adviser',
      `Are you sure you want to send final grades to the adviser?`,
      async () => {
        // User confirmed - now check if there are unverified students
        // Filter out students whose grades are already verified
        const unverifiedStudents = students.filter(student => !student.isVerified);
        const verifiedCount = students.length - unverifiedStudents.length;

        if (unverifiedStudents.length === 0) {
          toastStore.warning('All student grades have already been verified by the adviser. No grades to send.');
          return;
        }

        // Proceed with sending grades
        isSavingFinalGrades = true;
        saveMessage = '';
        saveSuccess = false;

        try {
          // Prepare final grades data for API (only for unverified students)
          const finalGradesData = unverifiedStudents.map(student => {
            const wwAvg = calculateAverage(student.writtenWork, gradingConfig.writtenWork.totals, 'writtenWork');
            const ptAvg = calculateAverage(student.performanceTasks, gradingConfig.performanceTasks.totals, 'performanceTasks');
            const qaAvg = calculateAverage(student.quarterlyAssessment, gradingConfig.quarterlyAssessment.totals, 'quarterlyAssessment');
            const finalGrade = calculateFinalGrade(student);

            const studentData = {
              student_id: student.accountNumber || student.account_number || student.id,
              written_work_average: wwAvg !== '' ? parseFloat(wwAvg) : null,
              performance_tasks_average: ptAvg !== '' ? parseFloat(ptAvg) : null,
              quarterly_assessment_average: qaAvg !== '' ? parseFloat(qaAvg) : null,
              final_grade: finalGrade !== '' ? parseFloat(finalGrade) : null,
              // Include individual grade items
              written_work_items: student.writtenWork || [],
              performance_tasks_items: student.performanceTasks || [],
              quarterly_assessment_items: student.quarterlyAssessment || []
            };

            return studentData;
          });

          const response = await authenticatedFetch('/api/grades', {
            method: 'POST',
            body: JSON.stringify({
              action: 'submit_final_grades',
              section_id: sectionId,
              subject_id: subjectId,
              grading_period_id: gradingPeriodId,
              teacher_id: $authStore.userData.id,
              final_grades: finalGradesData
            })
          });


          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API error response:', errorData);
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();

          saveSuccess = true;
          
          // Show appropriate success message based on whether some students were skipped
          if (verifiedCount > 0) {
            toastStore.success(`Final grades sent to adviser for ${unverifiedStudents.length} students. ${verifiedCount} verified students were skipped.`);
          } else {
            toastStore.success('Final grades have been sent to the adviser successfully!');
          }

          // Clear the message after 3 seconds
          setTimeout(() => {
            saveMessage = '';
          }, 3000);

        } catch (error) {
          console.error('Error saving final grades:', error);
          saveSuccess = false;
          saveMessage = error.message || 'Failed to save final grades';
          toastStore.error(saveMessage);

          // Clear the message after 5 seconds for errors
          setTimeout(() => {
            saveMessage = '';
          }, 5000);
        } finally {
          isSavingFinalGrades = false;
        }
      },
      () => {
        // User cancelled - do nothing
      }
    );
  }

  // Effect to reinitialize when students, gradingConfig, or subjectId changes
  $effect(() => {
    // Only track the specific dependencies we care about
    const studentCount = students.length;
    const config = gradingConfig;
    const currentSubjectId = subjectId;

    // Use untrack to prevent the effect from tracking changes to spreadsheetData
    untrack(() => {
      if (studentCount > 0 || config || currentSubjectId) {
        initializeSpreadsheetData();
      }
    });
  });

  // Effect to set up cleanup when component mounts
  $effect(() => {
    // Cleanup function for debounced auto-save timeout only
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  });

  // Function to handle editing column name and total score
  function editColumn(colIndex) {
    const mapping = getColumnMapping(colIndex);
    if (!mapping) {
      toastStore.error('Cannot edit this column');
      return;
    }

    const { assessmentType, columnIndex } = mapping;
    const currentName = getColumnName(assessmentType, columnIndex);
    const currentTotal = gradingConfig[assessmentType].totals[columnIndex] || 100;
    const gradeItemId = gradingConfig[assessmentType].gradeItemIds?.[columnIndex];

    if (!gradeItemId) {
      toastStore.error('Cannot edit column: Grade item ID not found');
      return;
    }

    // Check if any grades are verified to determine if delete should be disabled
    const gradesAreVerified = hasVerifiedGrades();

    // Use the new FormModal for two separate input fields
    modalStore.form(
      'Edit Column',
      'Edit the column name and total score for this assessment:',
      {
        label: 'Column Name',
        type: 'text',
        placeholder: 'Enter column name',
        value: currentName
      },
      {
        label: 'Total Score',
        type: 'number',
        placeholder: 'Enter total score',
        value: currentTotal,
        min: 1,
        max: 1000,
        disabled: gradesAreVerified,
        disabledReason: gradesAreVerified ? 'Cannot edit total score when grades are verified by adviser' : ''
      },
      async (newName, newTotal) => {
        // Validate inputs
        if (!newName || !newName.trim()) {
          toastStore.error('Column name cannot be empty');
          return;
        }

        const totalScore = parseInt(newTotal);
        if (isNaN(totalScore) || totalScore < 1 || totalScore > 1000) {
          toastStore.error('Total score must be between 1 and 1000');
          return;
        }

        try {
          // Update the grade item in the database
          const response = await authenticatedFetch('/api/grades/grade-items', {
            method: 'PUT',
            body: JSON.stringify({
              grade_item_id: gradeItemId,
              name: newName.trim(),
              total_score: totalScore
            })
          });

          // authenticatedFetch already handles response.ok and throws on error
          // If we reach here, the request was successful

          // Update local gradingConfig
          if (!gradingConfig[assessmentType].columnNames) {
            gradingConfig[assessmentType].columnNames = [];
          }
          gradingConfig[assessmentType].columnNames[columnIndex] = newName.trim();
          gradingConfig[assessmentType].totals[columnIndex] = totalScore;

          // Trigger reactivity
          gradingConfig = { ...gradingConfig };

          // Reinitialize spreadsheet to reflect changes
          initializeSpreadsheetData();

          toastStore.success('Column updated successfully');
        } catch (error) {
          console.error('Error updating column:', error);
          toastStore.error('Failed to update column. Please try again.');
        }
      },
      () => {
        // Do nothing on cancel
      },
      () => {
        // Delete column handler - show confirmation modal first
        modalStore.confirm(
          'Delete Column',
          `<p>Are you sure you want to permanently delete the column <strong>"${currentName}"</strong>?</p>
          <p class="grading-warning">This action will:</p>
          <ul class="grading-warning-list">
            <li>Permanently delete the column and all its grades</li>
            <li>Remove all student scores for this assessment</li>
            <li>This action cannot be undone</li>
          </ul>`,
          async () => {
            // Actual delete implementation
            try {
              const response = await authenticatedFetch('/api/grades/grade-items', {
                method: 'DELETE',
                body: JSON.stringify({
                  grade_item_id: gradeItemId
                })
              });

              // Check if response is ok
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
              }

              // Parse successful response
              const result = await response.json();

              // Remove from local gradingConfig - update all relevant properties
              gradingConfig[assessmentType].count -= 1;

              if (gradingConfig[assessmentType].columnNames) {
                gradingConfig[assessmentType].columnNames.splice(columnIndex, 1);
              }
              if (gradingConfig[assessmentType].totals) {
                gradingConfig[assessmentType].totals.splice(columnIndex, 1);
              }
              if (gradingConfig[assessmentType].columnPositions) {
                gradingConfig[assessmentType].columnPositions.splice(columnIndex, 1);
              }
              if (gradingConfig[assessmentType].gradeItemIds) {
                gradingConfig[assessmentType].gradeItemIds.splice(columnIndex, 1);
              }

              // Trigger reactivity
              gradingConfig = { ...gradingConfig };

              // Adjust student data to match new column count
              students = students.map(student => {
                const newStudent = { ...student };

                // Remove the deleted column's data from each assessment type
                if (assessmentType === 'writtenWork' && newStudent.writtenWork) {
                  newStudent.writtenWork.splice(columnIndex, 1);
                } else if (assessmentType === 'performanceTasks' && newStudent.performanceTasks) {
                  newStudent.performanceTasks.splice(columnIndex, 1);
                } else if (assessmentType === 'quarterlyAssessment' && newStudent.quarterlyAssessment) {
                  newStudent.quarterlyAssessment.splice(columnIndex, 1);
                }

                return newStudent;
              });

              // Reinitialize spreadsheet to reflect changes
              initializeSpreadsheetData();

              toastStore.success('Column deleted successfully');
            } catch (error) {
              console.error('Error deleting column:', error);
              toastStore.error('Failed to delete column. Please try again.');
            }
          },
          null,
          { size: 'medium' }
        );
      },
      {
        size: 'small',
        deleteDisabled: gradesAreVerified,
        deleteDisabledReason: gradesAreVerified ? 'Cannot delete columns when grades are verified by adviser' : ''
      }
    );
  }

  // Function to refresh grades from database
  async function refreshGrades() {
    try {
      // Show loading state
      toastStore.info('Refreshing grades from database...');
      
      // Fetch fresh student data from the API
      const authState = $authStore;
      const teacherId = authState.isAuthenticated ? authState.userData?.id : null;
      
      const params = new URLSearchParams({
        sectionId: sectionId.toString(),
        subjectId: subjectId.toString(),
        gradingPeriodId: gradingPeriodId.toString()
      });
      
      if (teacherId) {
        params.append('teacherId', teacherId.toString());
      }
      
      const response = await authenticatedFetch(`/api/class-students?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data?.students) {
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
        
        // Reinitialize spreadsheet data to reflect the refreshed grades
        initializeSpreadsheetData();
        
        // Reset save states since we have fresh data
        isDataSaved = true;
        hasUnsavedChanges = false;
        originalData = createDataSnapshot();
        
        toastStore.success('Grades refreshed successfully');
      } else {
        throw new Error(result.error || 'Failed to refresh grades');
      }
    } catch (error) {
      console.error('Error refreshing grades:', error);
      toastStore.error('Failed to refresh grades. Please try again.');
    }
  }

  // Expose saveGrades function to parent component  
  // svelte-ignore non_reactive_update (Function export for parent component access)
  export { saveGrades };
</script>

<svelte:window on:keydown={handleGlobalKeydown} />
  <div class="save-section">
    <div class="refresh-button-container">
      <button
        class="refresh-grades-button"
        onclick={refreshGrades}
        title="Refresh grades from database"
      >
        <span class="material-symbols-outlined">refresh</span>
        <span>Refresh</span>
      </button>
    </div>
    <div class="save-button-container">
      <button
        class="save-grades-button"
        class:saved={isDataSaved && !hasUnsavedChanges}
        onclick={saveGrades}
        disabled={isSaving || (isDataSaved && !hasUnsavedChanges)}
        title={isDataSaved && !hasUnsavedChanges ? "All grades are saved" : "Save all grades to database"}
      >
        {#if isSaving}
          <span class="material-symbols-outlined spinning">sync</span>
          <span>Saving...</span>
        {:else if isDataSaved && !hasUnsavedChanges}
          <span class="material-symbols-outlined">check_circle</span>
          <span>Grades Saved</span>
        {:else}
          <span class="material-symbols-outlined">save</span>
          <span>Save Grades</span>
        {/if}
      </button>
      <!-- New Final Grades Upload Button -->
      <button
        class="final-grades-button"
        onclick={saveFinalGrades}
        disabled={isSavingFinalGrades}
        title="Upload final grades (averages and computed final grades) to database"
      >
        {#if isSavingFinalGrades}
          <span class="material-symbols-outlined spinning">sync</span>
          <span>Uploading...</span>
        {:else}
          <span class="material-symbols-outlined">upload</span>
          <span>Send to Adviser</span>
        {/if}
      </button>
    </div>
  </div>
<div class="grading-spreadsheet" bind:this={spreadsheetContainer}>
  {#if isSpreadsheetLoading}
    <div class="spreadsheet-loading-overlay">
      <div class="spreadsheet-loader">
        <div class="system-loader"></div>
        <p>Loading grading spreadsheet...</p>
      </div>
    </div>
  {:else}
    <!-- Save Button Section -->
    <div class="spreadsheet-container" bind:this={spreadsheetContainer}>
    <table class="spreadsheet-table">
      <thead>
        <tr>
          {#each spreadsheetData[0] || [] as header, colIndex}
            <th class="spreadsheet-header"
                class:spreadsheet-student-info={colIndex < 2}
                class:calculated={isCalculatedColumn(colIndex)}
                class:final-grade={getColumnType(colIndex) === 'final-grade'}
                class:clickable={isAssessmentColumn(colIndex)}
                onclick={(e) => handleHeaderClick(colIndex, e)}
                title={isAssessmentColumn(colIndex) ? 'Click to set total scores' : ''}>
              <span class="header-text">{header}</span>
              {#if isAssessmentColumn(colIndex)}
                <div class="header-overlay">
                  <span class="header-icon material-symbols-outlined">settings</span>
                </div>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each spreadsheetData.slice(1) as row, rowIndex}
          <tr class="spreadsheet-row" class:verified={students[rowIndex]?.isVerified}>
            {#each row as cell, colIndex}
              <td
                class="spreadsheet-cell"
                class:selected={selectedCell?.row === rowIndex + 1 && selectedCell?.col === colIndex}
                class:editing={isEditing && selectedCell?.row === rowIndex + 1 && selectedCell?.col === colIndex}
                class:spreadsheet-student-info={colIndex < 2}
                class:calculated={isCalculatedColumn(colIndex)}
                class:final-grade={getColumnType(colIndex) === 'final-grade'}
                class:editable={!isCalculatedColumn(colIndex) && colIndex > 1}
                class:invalid={invalidCells.has(`${rowIndex + 1}-${colIndex}`)}
                onclick={(e) => handleCellClick(rowIndex + 1, colIndex, e)}
              >
                {#if isEditing && selectedCell?.row === rowIndex + 1 && selectedCell?.col === colIndex && !students[rowIndex]?.isVerified}
                  <!-- svelte-ignore a11y_autofocus (Intentional UX: auto-focus for spreadsheet cell editing) -->
                  <input
                    type="text"
                    class="cell-input"
                    bind:value={editValue}
                    onkeydown={(e) => handleKeyDown(e, rowIndex + 1, colIndex)}
                    onblur={() => {
                      // Save the value when losing focus
                      updateSpreadsheetData();
                      isEditing = false;
                    }}
                    autofocus
                  />
                {:else if isEditing && selectedCell?.row === rowIndex + 1 && selectedCell?.col === colIndex && students[rowIndex]?.isVerified}
                  <!-- Show read-only content for verified students -->
                  <span class="cell-content verified-cell">{cell}</span>
                {:else}
                  <span class="cell-content">{cell}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {/if}
</div>

