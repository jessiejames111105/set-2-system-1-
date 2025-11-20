import { w as push, G as head, y as pop, N as escape_html, K as attr_class, O as attr, P as stringify, F as writable, Q as get } from './index-Dr4ytFAP.js';
import { t as toastStore, a as authStore } from './studentDocReqModalStore-CvIR74KN.js';
import 'countup.js';

async function authenticatedFetch(url, options = {}) {
  const authState = get(authStore);
  const defaultHeaders = {
    "Content-Type": "application/json",
    ...options.headers
  };
  if (authState.isAuthenticated && authState.userData) {
    const userInfo = {
      id: authState.userData.id,
      name: authState.userData.name,
      account_number: authState.userData.accountNumber,
      account_type: authState.userData.account_type || authState.userData.accountType
    };
    defaultHeaders["x-user-info"] = JSON.stringify(userInfo);
    defaultHeaders["x-user-id"] = authState.userData.id.toString();
    defaultHeaders["x-user-account-number"] = authState.userData.accountNumber;
    defaultHeaders["x-user-name"] = encodeURIComponent(authState.userData.name);
  }
  const enhancedOptions = {
    ...options,
    headers: defaultHeaders
  };
  try {
    const response = await fetch(url, enhancedOptions);
    return response;
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}
const api = {
  get: async (url, options = {}) => {
    const response = await authenticatedFetch(url, { ...options, method: "GET" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  post: async (url, data, options = {}) => {
    const response = await authenticatedFetch(url, {
      ...options,
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  put: async (url, data, options = {}) => {
    const response = await authenticatedFetch(url, {
      ...options,
      method: "PUT",
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  delete: async (url, data, options = {}) => {
    const response = await authenticatedFetch(url, {
      ...options,
      method: "DELETE",
      body: data ? JSON.stringify(data) : void 0
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  patch: async (url, data, options = {}) => {
    const response = await authenticatedFetch(url, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
};
function Loginpage($$payload, $$props) {
  push();
  let idNumber = "";
  let password = "";
  let isAccountLocked = false;
  $$payload.out.push(`<div class="login-container"><button class="theme-toggle-btn" aria-label="Toggle dark mode"><span class="material-symbols-outlined">${escape_html("dark_mode")}</span></button> <div class="left-side">`);
  {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="login-header"><h1 class="login-title">Login</h1> <h2 class="login-subtitle">Enter your account details</h2></div> <form class="login-form" novalidate autocomplete="off"><div class="form-field"><div${attr_class(`custom-text-field ${stringify("")}`)}><span class="leading-icon material-symbols-outlined">badge</span> <input type="text"${attr("value", idNumber)} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" class="text-input" placeholder=" "/> <label class="text-label" for="idnumber-input">ID Number</label></div> `);
    {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--></div> <div class="form-field"><div${attr_class(`custom-text-field ${stringify("")}`)}><span class="leading-icon material-symbols-outlined">lock</span> <input${attr("type", "password")}${attr("value", password)} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" class="text-input" placeholder=" "/> <label class="text-label" for="password-input">Password</label> <button type="button" class="trailing-icon-button"${attr("aria-label", "Show password")}><span class="material-symbols-outlined">${escape_html("visibility_off")}</span></button></div> `);
    {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--></div> `);
    {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--> <button id="login-submit-btn" type="submit" class="custom-filled-button login-submit"${attr("disabled", isAccountLocked, true)} aria-label="Sign in">`);
    {
      $$payload.out.push("<!--[!-->");
      {
        $$payload.out.push("<!--[!-->");
        $$payload.out.push(`<span>Login</span>`);
      }
      $$payload.out.push(`<!--]-->`);
    }
    $$payload.out.push(`<!--]--></button> <button type="button" id="forgot-password-btn" class="custom-text-button forgot-password" aria-label="forgot-password">Forgot Password</button></form>`);
  }
  $$payload.out.push(`<!--]--></div> <div class="right-side"><div class="welcome-text"><h1 class="welcome-title">${escape_html("Welcome")}</h1> <p class="welcome-subtitle">${escape_html("Login to access your account")}</p></div></div></div>`);
  pop();
}
const CACHE_DURATION$6 = 5 * 60 * 1e3;
const CACHE_KEY_PREFIX$6 = "student_notifications_";
function createStudentNotificationStore() {
  const initialState = {
    notifications: [],
    unreadCount: 0,
    totalCount: 0,
    currentFilter: "all",
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    currentStudentId: null
  };
  const { subscribe, set, update } = writable(initialState);
  function getAuthHeaders2() {
    const authState = get(authStore);
    if (!authState?.isAuthenticated || !authState.userData) {
      return {};
    }
    const userInfo = {
      id: authState.userData.id,
      name: authState.userData.name,
      account_number: authState.userData.accountNumber,
      account_type: authState.userData.account_type || authState.userData.accountType
    };
    return {
      "x-user-info": JSON.stringify(userInfo)
    };
  }
  function getCacheKey(studentId, filter) {
    return `${CACHE_KEY_PREFIX$6}${studentId}_${filter}`;
  }
  function isCacheValid(cachedData) {
    if (!cachedData || !cachedData.timestamp) return false;
    return Date.now() - cachedData.timestamp < CACHE_DURATION$6;
  }
  function getCachedData2(studentId, filter) {
    try {
      const cacheKey = getCacheKey(studentId, filter);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        return parsedData.data;
      }
    } catch (error) {
      console.warn("Failed to retrieve cached student notifications data:", error);
    }
    return null;
  }
  function getValidCachedData(studentId, filter) {
    try {
      const cacheKey = getCacheKey(studentId, filter);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        if (isCacheValid(parsedData)) {
          return parsedData.data;
        }
      }
    } catch (error) {
      console.warn("Failed to retrieve cached student notifications data:", error);
    }
    return null;
  }
  function cacheData2(studentId, filter, data) {
    try {
      const cacheKey = getCacheKey(studentId, filter);
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn("Failed to cache student notifications data:", error);
    }
  }
  function processNotificationData(data) {
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      timestamp: notification.created_at || notification.timestamp,
      isRead: notification.is_read || notification.isRead || false,
      adminNote: notification.admin_note || notification.adminNote || null,
      rejectionReason: notification.rejection_reason || notification.rejectionReason || null,
      metadata: notification.metadata || {}
    }));
  }
  function calculateStats(notifications) {
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    const totalCount = notifications.length;
    return { unreadCount, totalCount };
  }
  async function loadNotifications(studentId, filter = "all", silent = false) {
    try {
      update((state) => ({
        ...state,
        isLoading: !silent,
        isRefreshing: silent,
        error: null,
        currentStudentId: studentId,
        currentFilter: filter
      }));
      const params = new URLSearchParams({
        studentId,
        filter
      });
      const response = await fetch(`/api/student-notifications?${params.toString()}`, {
        headers: getAuthHeaders2()
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch notifications");
      }
      const processedNotifications = processNotificationData(result.data || []);
      const stats = calculateStats(processedNotifications);
      const newState = {
        notifications: processedNotifications,
        unreadCount: stats.unreadCount,
        totalCount: stats.totalCount,
        currentFilter: filter,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        currentStudentId: studentId
      };
      update((state) => ({
        ...state,
        ...newState
      }));
      cacheData2(studentId, filter, {
        notifications: processedNotifications,
        unreadCount: stats.unreadCount,
        totalCount: stats.totalCount,
        lastUpdated: newState.lastUpdated
      });
    } catch (error) {
      console.error("Error loading student notifications:", error);
      const cachedData = getCachedData2(studentId, filter);
      if (cachedData) {
        update((state) => ({
          ...state,
          notifications: cachedData.notifications || [],
          unreadCount: cachedData.unreadCount || 0,
          totalCount: cachedData.totalCount || 0,
          lastUpdated: cachedData.lastUpdated,
          isLoading: false,
          isRefreshing: false,
          error: null
          // Don't set error since we have cached data
        }));
        toastStore.error("No internet connection. Showing offline data.");
      } else {
        update((state) => ({
          ...state,
          isLoading: false,
          isRefreshing: false,
          error: error.message,
          notifications: [],
          unreadCount: 0,
          totalCount: 0
        }));
      }
    }
  }
  async function updateNotificationStatus(studentId, notificationId, isRead) {
    try {
      const response = await fetch("/api/student-notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders2()
        },
        body: JSON.stringify({
          studentId,
          notificationId,
          isRead
        })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to update notification status");
      }
      update((state) => {
        const notifications = state.notifications.map(
          (n) => n.id === notificationId ? { ...n, isRead } : n
        );
        const stats = calculateStats(notifications);
        cacheData2(studentId, state.currentFilter, {
          notifications,
          unreadCount: stats.unreadCount,
          totalCount: stats.totalCount,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        });
        return {
          ...state,
          notifications,
          unreadCount: stats.unreadCount
        };
      });
    } catch (error) {
      console.error("Error updating notification status:", error);
      toastStore.error("Failed to update notification status");
    }
  }
  async function deleteNotification(studentId, notificationId) {
    try {
      const response = await fetch("/api/student-notifications", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders2()
        },
        body: JSON.stringify({
          studentId,
          notificationId
        })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to delete notification");
      }
      update((state) => {
        const notifications = state.notifications.filter((n) => n.id !== notificationId);
        const stats = calculateStats(notifications);
        cacheData2(studentId, state.currentFilter, {
          notifications,
          unreadCount: stats.unreadCount,
          totalCount: stats.totalCount,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        });
        return {
          ...state,
          notifications,
          unreadCount: stats.unreadCount,
          totalCount: stats.totalCount
        };
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
      toastStore.error("Failed to delete notification");
      throw error;
    }
  }
  async function markAllAsRead(studentId) {
    try {
      const response = await fetch("/api/student-notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders2()
        },
        body: JSON.stringify({
          studentId,
          markAllAsRead: true
        })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to mark all as read");
      }
      update((state) => {
        const notifications = state.notifications.map((n) => ({ ...n, isRead: true }));
        cacheData2(studentId, state.currentFilter, {
          notifications,
          unreadCount: 0,
          totalCount: state.totalCount,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        });
        return {
          ...state,
          notifications,
          unreadCount: 0
        };
      });
      toastStore.success("All notifications marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toastStore.error("Failed to mark all as read");
    }
  }
  async function clearAllRead(studentId) {
    try {
      const response = await fetch("/api/student-notifications", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders2()
        },
        body: JSON.stringify({
          studentId,
          clearAllRead: true
        })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to clear read notifications");
      }
      update((state) => {
        const notifications = state.notifications.filter((n) => !n.isRead);
        const stats = calculateStats(notifications);
        cacheData2(studentId, state.currentFilter, {
          notifications,
          unreadCount: stats.unreadCount,
          totalCount: stats.totalCount,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        });
        return {
          ...state,
          notifications,
          totalCount: stats.totalCount
        };
      });
    } catch (error) {
      console.error("Error clearing read notifications:", error);
      toastStore.error("Failed to clear read notifications");
      throw error;
    }
  }
  function setFilter(filter) {
    update((state) => ({
      ...state,
      currentFilter: filter
    }));
  }
  function init(studentId, filter = "all") {
    const cachedData = getValidCachedData(studentId, filter);
    if (cachedData) {
      update((state) => ({
        ...state,
        ...cachedData,
        currentStudentId: studentId,
        currentFilter: filter,
        isLoading: false,
        isRefreshing: false,
        error: null
      }));
      return true;
    }
    update((state) => ({
      ...state,
      currentStudentId: studentId,
      currentFilter: filter,
      isLoading: true,
      isRefreshing: false,
      error: null
    }));
    return false;
  }
  function forceRefresh(studentId, filter = "all") {
    try {
      const cacheKey = getCacheKey(studentId, filter);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn("Failed to clear student notifications cache:", error);
    }
    update((state) => ({
      ...initialState,
      currentStudentId: studentId,
      currentFilter: filter,
      isLoading: true
    }));
    return store.loadNotifications(studentId, filter, false);
  }
  function clearAllCache(studentId) {
    try {
      const keys = Object.keys(localStorage);
      const prefix = `${CACHE_KEY_PREFIX$6}${studentId}_`;
      keys.forEach((key) => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn("Failed to clear all notification cache:", error);
    }
  }
  const store = {
    subscribe,
    init,
    setFilter,
    loadNotifications,
    updateNotificationStatus,
    deleteNotification,
    markAllAsRead,
    clearAllRead,
    forceRefresh,
    clearAllCache,
    getCachedData: (studentId, filter) => getCachedData2(studentId, filter)
  };
  return store;
}
createStudentNotificationStore();
const CACHE_DURATION$5 = 5 * 60 * 1e3;
const CACHE_KEY_PREFIX$5 = "student_profile_";
function createStudentProfileStore() {
  const initialState = {
    studentData: null,
    studentProfileData: null,
    studentSections: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    currentStudentId: null
  };
  const { subscribe, set, update } = writable(initialState);
  function getCacheKey(studentId) {
    return `${CACHE_KEY_PREFIX$5}${studentId}`;
  }
  function isCacheValid(cachedData) {
    if (!cachedData || !cachedData.timestamp) return false;
    return Date.now() - cachedData.timestamp < CACHE_DURATION$5;
  }
  function getCachedData2(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        return parsedData.data;
      }
    } catch (error) {
      console.warn("Failed to retrieve cached student profile data:", error);
    }
    return null;
  }
  function getValidCachedData(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        if (isCacheValid(parsedData)) {
          return parsedData.data;
        }
      }
    } catch (error) {
      console.warn("Failed to retrieve cached student profile data:", error);
    }
    return null;
  }
  function cacheData2(studentId, data) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn("Failed to cache student profile data:", error);
    }
  }
  async function loadProfile(studentId, silent = false) {
    try {
      update((state) => ({
        ...state,
        isLoading: !silent,
        isRefreshing: silent,
        error: null,
        currentStudentId: studentId
      }));
      const profileResponse = await authenticatedFetch(`/api/student-profile?studentId=${studentId}`);
      if (!profileResponse.ok) {
        throw new Error("Failed to fetch student profile data");
      }
      const profileResult = await profileResponse.json();
      if (!profileResult.success) {
        throw new Error(profileResult.error || "Failed to fetch student profile data");
      }
      const studentProfileData = profileResult.data;
      let currentStudentData = null;
      try {
        const userResponse = await authenticatedFetch(`/api/users?id=${studentId}`);
        if (userResponse.ok) {
          const userResult = await userResponse.json();
          if (userResult.success && userResult.user) {
            currentStudentData = {
              id: userResult.user.id || studentId,
              number: userResult.user.account_number,
              name: userResult.user.full_name,
              firstName: userResult.user.first_name,
              lastName: userResult.user.last_name,
              middleInitial: userResult.user.middle_initial || "",
              email: userResult.user.email,
              contactNumber: userResult.user.contact_number,
              address: userResult.user.address,
              birthdate: userResult.user.birth_date,
              age: userResult.user.age,
              guardian: userResult.user.guardian,
              gender: userResult.user.gender,
              gradeLevel: studentProfileData?.section?.gradeLevel || userResult.user.grade_level
            };
          }
        }
      } catch (err) {
        console.warn("Failed to fetch basic student data:", err);
      }
      if (!currentStudentData) {
        currentStudentData = {
          id: studentId,
          number: studentId,
          name: "Student",
          gradeLevel: studentProfileData?.section?.gradeLevel || "Not assigned"
        };
      }
      if (!studentProfileData?.subjects || studentProfileData.subjects.length === 0) {
        try {
          const currentQuarterResponse = await authenticatedFetch("/api/current-quarter");
          const currentQuarterData = await currentQuarterResponse.json();
          const currentQuarter = currentQuarterData.data?.currentQuarter || 2;
          const schoolYear = currentQuarterData.data?.currentSchoolYear || "2025-2026";
          const gradesResponse = await authenticatedFetch(`/api/student-grades?student_id=${studentId}&quarter=${currentQuarter}&school_year=${schoolYear}`);
          if (gradesResponse.ok) {
            const gradesResult = await gradesResponse.json();
            if (gradesResult.success && gradesResult.data.grades) {
              const subjectsFromGrades = gradesResult.data.grades.map((grade) => ({
                id: grade.subject_id,
                name: grade.name,
                code: grade.code || "",
                teacher: grade.teacher,
                color: getSubjectColorFromName(grade.name)
                // Helper function to get color
              }));
              if (studentProfileData) {
                studentProfileData.subjects = subjectsFromGrades;
              } else {
                studentProfileData = {
                  section: {
                    id: null,
                    name: "No section assigned",
                    gradeLevel: currentStudentData.grade_level || "Not assigned",
                    adviser: "No adviser"
                  },
                  subjects: subjectsFromGrades,
                  academicSummary: {
                    generalAverage: gradesResult.data.statistics.overallAverage || "Not available",
                    classRank: "Not available",
                    totalStudentsInSection: 0,
                    totalSubjectsEnrolled: subjectsFromGrades.length,
                    totalSubjectsWithGrades: gradesResult.data.statistics.countedSubjects || 0
                  }
                };
              }
            }
          }
        } catch (err) {
          console.warn("Failed to fetch subjects from grades API:", err);
        }
      }
      let studentSections = [];
      try {
        const currentQuarterResponse = await authenticatedFetch("/api/current-quarter");
        const currentQuarterData = await currentQuarterResponse.json();
        const schoolYear = currentQuarterData.data?.currentSchoolYear || "2025-2026";
        const sectionsResponse = await authenticatedFetch(`/api/student-sections?studentId=${studentId}&schoolYear=${schoolYear}`);
        if (sectionsResponse.ok) {
          const sectionsResult = await sectionsResponse.json();
          if (sectionsResult.success) {
            studentSections = sectionsResult.data.classData || [];
          }
        }
      } catch (err) {
        console.warn("Failed to fetch student sections:", err);
      }
      const profileData = {
        studentData: currentStudentData,
        studentProfileData,
        studentSections,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      };
      update((state) => ({
        ...state,
        ...profileData,
        isLoading: false,
        isRefreshing: false,
        error: null
      }));
      cacheData2(studentId, profileData);
    } catch (error) {
      console.error("Error loading student profile:", error);
      const cachedData = getCachedData2(studentId);
      if (cachedData) {
        update((state) => ({
          ...state,
          studentData: cachedData.studentData,
          studentProfileData: cachedData.studentProfileData,
          studentSections: cachedData.studentSections || [],
          lastUpdated: cachedData.lastUpdated,
          isLoading: false,
          isRefreshing: false,
          error: null
          // Don't set error since we have cached data
        }));
        toastStore.error("No internet connection. Showing offline data.");
      } else {
        update((state) => ({
          ...state,
          isLoading: false,
          isRefreshing: false,
          error: error.message
        }));
      }
    }
  }
  function getSubjectColorFromName(subjectName) {
    const subjectColors = {
      "Mathematics": ["#4F46E5", "#6366F1", "#8B5CF6", "#3B82F6"],
      "Math": ["#4F46E5", "#6366F1", "#8B5CF6", "#3B82F6"],
      "Science": ["#059669", "#10B981", "#34D399", "#047857"],
      "English": ["#DC2626", "#EF4444", "#F87171", "#B91C1C"],
      "Physical Education": ["#EA580C", "#F97316", "#FB923C", "#C2410C"],
      "MAPEH": ["#EA580C", "#F97316", "#FB923C", "#C2410C"],
      "PE": ["#EA580C", "#F97316", "#FB923C", "#C2410C"],
      "Filipino": ["#7C2D12", "#A16207", "#D97706", "#92400E"],
      "Araling Panlipunan": ["#B45309", "#D97706", "#F59E0B", "#A16207"],
      "History": ["#B45309", "#D97706", "#F59E0B", "#A16207"],
      "Computer": ["#6366F1", "#8B5CF6", "#A855F7", "#7C3AED"],
      "Technology": ["#6366F1", "#8B5CF6", "#A855F7", "#7C3AED"],
      "Arts": ["#C026D3", "#D946EF", "#E879F9", "#A21CAF"],
      "Music": ["#EC4899", "#F472B6", "#F9A8D4", "#DB2777"],
      "Health": ["#16A34A", "#22C55E", "#4ADE80", "#15803D"],
      "Values": ["#0891B2", "#06B6D4", "#22D3EE", "#0E7490"],
      "Research": ["#7C2D12", "#A16207", "#D97706", "#92400E"],
      "TLE": ["#9333EA", "#A855F7", "#C084FC", "#7E22CE"],
      "ESP": ["#0891B2", "#06B6D4", "#22D3EE", "#0E7490"]
    };
    const fallbackColors = [
      "#EF4444",
      "#F97316",
      "#F59E0B",
      "#84CC16",
      "#22C55E",
      "#10B981",
      "#14B8A6",
      "#06B6D4",
      "#0EA5E9",
      "#3B82F6",
      "#6366F1",
      "#8B5CF6",
      "#A855F7",
      "#D946EF",
      "#EC4899",
      "#F43F5E",
      "#E11D48",
      "#BE123C",
      "#9F1239",
      "#881337"
    ];
    function simpleHash(str) {
      let hash2 = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash2 = (hash2 << 5) - hash2 + char;
        hash2 = hash2 & hash2;
      }
      return Math.abs(hash2);
    }
    const normalizedName = subjectName.toLowerCase().trim();
    for (const [key, colorArray] of Object.entries(subjectColors)) {
      if (normalizedName.includes(key.toLowerCase())) {
        const hash2 = simpleHash(subjectName);
        const colorIndex2 = hash2 % colorArray.length;
        return colorArray[colorIndex2];
      }
    }
    const hash = simpleHash(subjectName);
    const colorIndex = hash % fallbackColors.length;
    return fallbackColors[colorIndex];
  }
  function init(studentId) {
    const cachedData = getValidCachedData(studentId);
    if (cachedData) {
      update((state) => ({
        ...state,
        ...cachedData,
        currentStudentId: studentId,
        isLoading: false,
        isRefreshing: false,
        error: null
      }));
      return true;
    }
    update((state) => ({
      ...state,
      currentStudentId: studentId,
      isLoading: true,
      isRefreshing: false,
      error: null
    }));
    return false;
  }
  function forceRefresh(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn("Failed to clear student profile cache:", error);
    }
    update((state) => ({
      ...initialState,
      currentStudentId: studentId,
      isLoading: true
    }));
    return store.loadProfile(studentId, false);
  }
  const store = {
    subscribe,
    init,
    loadProfile,
    forceRefresh,
    getCachedData: (studentId) => getCachedData2(studentId)
  };
  return store;
}
createStudentProfileStore();
const CACHE_DURATION$4 = 5 * 60 * 1e3;
const CACHE_KEY_PREFIX$4 = "student_grades_";
const AI_ANALYSIS_CACHE_KEY_PREFIX = "student_ai_analysis_";
const AI_ANALYSIS_CACHE_DURATION = 7 * 24 * 60 * 60 * 1e3;
function createStudentGradeStore() {
  const initialState = {
    grades: [],
    statistics: {
      overallAverage: 0,
      totalSubjects: 0
    },
    sectionInfo: null,
    classRank: null,
    totalStudentsInSection: 0,
    currentQuarter: 2,
    currentQuarterName: "2nd Quarter",
    currentSchoolYear: "2025-2026",
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    currentStudentId: null,
    previousQuarterAverage: null,
    averageChange: null,
    // AI Analysis cache
    aiAnalysis: null,
    aiAnalysisLoading: false,
    aiAnalysisError: null,
    aiAnalysisTimestamp: null
  };
  const { subscribe, set, update } = writable(initialState);
  function getAuthHeaders2() {
    const authState = get(authStore);
    if (!authState?.isAuthenticated || !authState.userData) {
      return {};
    }
    const userInfo = {
      id: authState.userData.id,
      name: authState.userData.name,
      account_number: authState.userData.accountNumber,
      account_type: authState.userData.account_type || authState.userData.accountType
    };
    return {
      "x-user-info": JSON.stringify(userInfo)
    };
  }
  function getCacheKey(studentId, quarter, schoolYear) {
    return `${CACHE_KEY_PREFIX$4}${studentId}_${quarter}_${schoolYear}`;
  }
  function isCacheValid(cachedData) {
    if (!cachedData || !cachedData.timestamp) return false;
    return Date.now() - cachedData.timestamp < CACHE_DURATION$4;
  }
  function getCachedData2(studentId, quarter, schoolYear) {
    try {
      const cacheKey = getCacheKey(studentId, quarter, schoolYear);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        return parsedData.data;
      }
    } catch (error) {
      console.warn("Failed to retrieve cached student grades data:", error);
    }
    return null;
  }
  function getValidCachedData(studentId, quarter, schoolYear) {
    try {
      const cacheKey = getCacheKey(studentId, quarter, schoolYear);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        if (isCacheValid(parsedData)) {
          return parsedData.data;
        }
      }
    } catch (error) {
      console.warn("Failed to retrieve cached student grades data:", error);
    }
    return null;
  }
  function cacheData2(studentId, quarter, schoolYear, data) {
    try {
      const cacheKey = getCacheKey(studentId, quarter, schoolYear);
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn("Failed to cache student grades data:", error);
    }
  }
  async function fetchCurrentQuarter() {
    try {
      const response = await fetch("/api/current-quarter", {
        headers: getAuthHeaders2()
      });
      const data = await response.json();
      if (data.success && data.data) {
        return {
          currentQuarter: data.data.currentQuarter,
          currentQuarterName: data.data.quarterName,
          currentSchoolYear: data.data.currentSchoolYear
        };
      }
    } catch (err) {
      console.error("Error fetching current quarter/school year:", err);
    }
    return {
      currentQuarter: 2,
      currentQuarterName: "2nd Quarter",
      currentSchoolYear: "2025-2026"
    };
  }
  async function fetchStudentProfile(studentId) {
    try {
      const response = await fetch(`/api/student-profile?studentId=${studentId}`, {
        headers: getAuthHeaders2()
      });
      const result = await response.json();
      if (result.success) {
        const { section } = result.data;
        return {
          sectionInfo: section
        };
      }
    } catch (err) {
      console.error("Error fetching student profile:", err);
    }
    return {
      sectionInfo: null
    };
  }
  async function fetchClassRank(studentId, quarter, schoolYear) {
    try {
      const response = await fetch(`/api/class-rankings?studentId=${studentId}&quarter=${quarter}&schoolYear=${schoolYear}`, {
        headers: getAuthHeaders2()
      });
      const result = await response.json();
      if (result.success) {
        return {
          classRank: result.myRank,
          totalStudentsInSection: result.totalStudents
        };
      }
    } catch (err) {
      console.error("Error fetching class rank:", err);
    }
    return {
      classRank: null,
      totalStudentsInSection: 0
    };
  }
  async function fetchPreviousQuarterAverage(studentId, currentQuarter, schoolYear) {
    try {
      let prevQuarter = currentQuarter - 1;
      let prevSchoolYear = schoolYear;
      if (prevQuarter < 1) {
        prevQuarter = 4;
        const [startYear, endYear] = schoolYear.split("-").map((y) => parseInt(y));
        prevSchoolYear = `${startYear - 1}-${endYear - 1}`;
      }
      const response = await fetch(`/api/student-grades?student_id=${studentId}&quarter=${prevQuarter}&school_year=${prevSchoolYear}`, {
        headers: getAuthHeaders2()
      });
      const result = await response.json();
      if (result.success && result.data.statistics) {
        return result.data.statistics.overallAverage || null;
      }
    } catch (err) {
      console.error("Error fetching previous quarter average:", err);
    }
    return null;
  }
  async function loadGrades(studentId, quarter = null, schoolYear = null, silent = false) {
    try {
      update((state) => ({
        ...state,
        isLoading: !silent,
        isRefreshing: silent,
        error: null,
        currentStudentId: studentId
      }));
      let quarterData;
      if (!quarter || !schoolYear) {
        quarterData = await fetchCurrentQuarter();
        quarter = quarter || quarterData.currentQuarter;
        schoolYear = schoolYear || quarterData.currentSchoolYear;
      } else {
        quarterData = {
          currentQuarter: quarter,
          currentQuarterName: `${quarter}${quarter === 1 ? "st" : quarter === 2 ? "nd" : quarter === 3 ? "rd" : "th"} Quarter`,
          currentSchoolYear: schoolYear
        };
      }
      const [gradesResult, profileData, rankData, previousAverage] = await Promise.all([
        fetch(`/api/student-grades?student_id=${studentId}&quarter=${quarter}&school_year=${schoolYear}`, {
          headers: getAuthHeaders2()
        }).then((res) => res.json()),
        fetchStudentProfile(studentId),
        fetchClassRank(studentId, quarter, schoolYear),
        fetchPreviousQuarterAverage(studentId, quarter, schoolYear)
      ]);
      if (!gradesResult.success) {
        throw new Error(gradesResult.error || "Failed to fetch grades data");
      }
      const currentAverage = gradesResult.data.statistics?.overallAverage || 0;
      let averageChange = null;
      if (previousAverage !== null && currentAverage > 0) {
        averageChange = currentAverage - previousAverage;
      }
      const newState = {
        grades: gradesResult.data.grades || [],
        statistics: gradesResult.data.statistics || { overallAverage: 0, totalSubjects: 0 },
        sectionInfo: profileData.sectionInfo,
        classRank: rankData.classRank,
        totalStudentsInSection: rankData.totalStudentsInSection,
        currentQuarter: quarter,
        currentQuarterName: quarterData.currentQuarterName,
        currentSchoolYear: schoolYear,
        previousQuarterAverage: previousAverage,
        averageChange,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        currentStudentId: studentId
      };
      update((state) => ({
        ...state,
        ...newState
      }));
      cacheData2(studentId, quarter, schoolYear, {
        grades: newState.grades,
        statistics: newState.statistics,
        sectionInfo: newState.sectionInfo,
        classRank: newState.classRank,
        totalStudentsInSection: newState.totalStudentsInSection,
        currentQuarter: quarter,
        currentQuarterName: quarterData.currentQuarterName,
        currentSchoolYear: schoolYear,
        previousQuarterAverage: newState.previousQuarterAverage,
        averageChange: newState.averageChange,
        lastUpdated: newState.lastUpdated
      });
    } catch (error) {
      console.error("Error loading student grades:", error);
      const cachedData = getCachedData2(studentId, quarter, schoolYear);
      if (cachedData) {
        update((state) => ({
          ...state,
          grades: cachedData.grades || [],
          statistics: cachedData.statistics || { overallAverage: 0, totalSubjects: 0 },
          sectionInfo: cachedData.sectionInfo,
          classRank: cachedData.classRank,
          totalStudentsInSection: cachedData.totalStudentsInSection,
          currentQuarter: cachedData.currentQuarter,
          currentQuarterName: cachedData.currentQuarterName,
          currentSchoolYear: cachedData.currentSchoolYear,
          previousQuarterAverage: cachedData.previousQuarterAverage,
          averageChange: cachedData.averageChange,
          lastUpdated: cachedData.lastUpdated,
          isLoading: false,
          isRefreshing: false,
          error: null
          // Don't set error since we have cached data
        }));
        toastStore.error("No internet connection. Showing offline data.");
      } else {
        update((state) => ({
          ...state,
          isLoading: false,
          isRefreshing: false,
          error: error.message,
          grades: [],
          statistics: {
            overallAverage: 0,
            totalSubjects: 0
          },
          previousQuarterAverage: null,
          averageChange: null
        }));
      }
    }
  }
  function init(studentId, quarter = null, schoolYear = null) {
    let currentStudentId;
    subscribe((state) => {
      currentStudentId = state.currentStudentId;
    })();
    if (currentStudentId && currentStudentId !== studentId) {
      update((state) => ({
        ...state,
        aiAnalysis: null,
        aiAnalysisLoading: false,
        aiAnalysisError: null,
        aiAnalysisTimestamp: null
      }));
    }
    if (!quarter || !schoolYear) {
      fetchCurrentQuarter().then((quarterData) => {
        const cachedData2 = getValidCachedData(
          studentId,
          quarterData.currentQuarter,
          quarterData.currentSchoolYear
        );
        if (cachedData2) {
          update((state) => ({
            ...state,
            ...cachedData2,
            currentStudentId: studentId,
            isLoading: false,
            isRefreshing: false,
            error: null,
            // Clear AI analysis for new student
            aiAnalysis: null,
            aiAnalysisLoading: false,
            aiAnalysisError: null,
            aiAnalysisTimestamp: null
          }));
        } else {
          update((state) => ({
            ...state,
            currentStudentId: studentId,
            currentQuarter: quarterData.currentQuarter,
            currentQuarterName: quarterData.currentQuarterName,
            currentSchoolYear: quarterData.currentSchoolYear,
            isLoading: true,
            isRefreshing: false,
            error: null,
            // Clear AI analysis for new student
            aiAnalysis: null,
            aiAnalysisLoading: false,
            aiAnalysisError: null,
            aiAnalysisTimestamp: null
          }));
        }
      });
      return false;
    }
    const cachedData = getValidCachedData(studentId, quarter, schoolYear);
    if (cachedData) {
      update((state) => ({
        ...state,
        ...cachedData,
        currentStudentId: studentId,
        isLoading: false,
        isRefreshing: false,
        error: null,
        // Clear AI analysis for new student
        aiAnalysis: null,
        aiAnalysisLoading: false,
        aiAnalysisError: null,
        aiAnalysisTimestamp: null
      }));
      return true;
    }
    update((state) => ({
      ...state,
      currentStudentId: studentId,
      currentQuarter: quarter,
      currentSchoolYear: schoolYear,
      isLoading: true,
      isRefreshing: false,
      error: null,
      // Clear AI analysis for new student
      aiAnalysis: null,
      aiAnalysisLoading: false,
      aiAnalysisError: null,
      aiAnalysisTimestamp: null
    }));
    return false;
  }
  async function changeQuarter(studentId, quarter, schoolYear) {
    const cachedData = getValidCachedData(studentId, quarter, schoolYear);
    if (cachedData) {
      update((state) => ({
        ...state,
        ...cachedData,
        currentStudentId: studentId,
        isLoading: false,
        isRefreshing: false,
        error: null
      }));
    }
    await loadGrades(studentId, quarter, schoolYear, !!cachedData);
  }
  function forceRefresh(studentId, quarter, schoolYear) {
    try {
      const cacheKey = getCacheKey(studentId, quarter, schoolYear);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn("Failed to clear student grades cache:", error);
    }
    update((state) => ({
      ...initialState,
      currentStudentId: studentId,
      currentQuarter: quarter,
      currentSchoolYear: schoolYear,
      isLoading: true
    }));
    return store.loadGrades(studentId, quarter, schoolYear, false);
  }
  function clearAllCache(studentId) {
    try {
      const keys = Object.keys(localStorage);
      const prefix = `${CACHE_KEY_PREFIX$4}${studentId}_`;
      const aiPrefix = `${AI_ANALYSIS_CACHE_KEY_PREFIX}${studentId}_`;
      keys.forEach((key) => {
        if (key.startsWith(prefix) || key.startsWith(aiPrefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn("Failed to clear all cache:", error);
    }
  }
  function getAiAnalysisCacheKey(studentId, quarter, schoolYear) {
    return `${AI_ANALYSIS_CACHE_KEY_PREFIX}${studentId}_${quarter}_${schoolYear}`;
  }
  function getCachedAiAnalysis(studentId, quarter, schoolYear) {
    try {
      const cacheKey = getAiAnalysisCacheKey(studentId, quarter, schoolYear);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        if (Date.now() - parsedData.timestamp < AI_ANALYSIS_CACHE_DURATION) {
          return parsedData.data;
        }
      }
    } catch (error) {
      console.warn("Failed to retrieve cached AI analysis:", error);
    }
    return null;
  }
  function cacheAiAnalysis(studentId, quarter, schoolYear, analysisData) {
    try {
      const cacheKey = getAiAnalysisCacheKey(studentId, quarter, schoolYear);
      const cacheEntry = {
        data: analysisData,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn("Failed to cache AI analysis:", error);
    }
  }
  async function loadAiAnalysis(studentId, quarter, schoolYear, forceRefresh2 = false) {
    try {
      update((state) => ({
        ...state,
        aiAnalysisLoading: true,
        aiAnalysisError: null
      }));
      let previousQuarterInfo = null;
      let prevQuarter = quarter - 1;
      let prevSchoolYear = schoolYear;
      if (prevQuarter < 1) {
        prevQuarter = 4;
        const [startYear, endYear] = schoolYear.split("-").map((y) => parseInt(y));
        prevSchoolYear = `${startYear - 1}-${endYear - 1}`;
      }
      previousQuarterInfo = {
        quarter: prevQuarter,
        schoolYear: prevSchoolYear
      };
      if (!forceRefresh2) {
        const cachedAnalysis = getCachedAiAnalysis(studentId, quarter, schoolYear);
        if (cachedAnalysis) {
          console.log("AI Analysis: Using localStorage cache");
          update((state) => ({
            ...state,
            aiAnalysis: cachedAnalysis,
            aiAnalysisLoading: false,
            aiAnalysisError: null,
            aiAnalysisTimestamp: Date.now()
          }));
          return cachedAnalysis;
        }
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9e4);
      try {
        const response = await fetch("/api/ai-grade-analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders2()
          },
          body: JSON.stringify({
            studentId,
            quarter,
            schoolYear,
            forceRefresh: forceRefresh2,
            previousQuarterInfo
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error("Failed to fetch AI analysis");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let jsonString = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          jsonString += decoder.decode(value, { stream: true });
        }
        const analysisData = JSON.parse(jsonString);
        if (!analysisData || !analysisData.overallInsight) {
          throw new Error("Invalid analysis data structure");
        }
        cacheAiAnalysis(studentId, quarter, schoolYear, analysisData);
        console.log("AI Analysis: Cached to localStorage and database");
        update((state) => ({
          ...state,
          aiAnalysis: analysisData,
          aiAnalysisLoading: false,
          aiAnalysisError: null,
          aiAnalysisTimestamp: Date.now()
        }));
        return analysisData;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          throw new Error("AI analysis is taking longer than expected. Please try again.");
        }
        throw fetchError;
      }
    } catch (error) {
      console.error("Error loading AI analysis:", error);
      const cachedAnalysis = getCachedAiAnalysis(studentId, quarter, schoolYear);
      if (cachedAnalysis) {
        update((state) => ({
          ...state,
          aiAnalysis: cachedAnalysis,
          aiAnalysisLoading: false,
          aiAnalysisError: null,
          aiAnalysisTimestamp: Date.now()
        }));
        return cachedAnalysis;
      }
      update((state) => ({
        ...state,
        aiAnalysis: null,
        aiAnalysisLoading: false,
        aiAnalysisError: error.message,
        aiAnalysisTimestamp: null
      }));
      throw error;
    }
  }
  function clearAiAnalysis() {
    update((state) => ({
      ...state,
      aiAnalysis: null,
      aiAnalysisLoading: false,
      aiAnalysisError: null,
      aiAnalysisTimestamp: null
    }));
  }
  function initAiAnalysis(studentId, quarter, schoolYear) {
    const cachedAnalysis = getCachedAiAnalysis(studentId, quarter, schoolYear);
    if (cachedAnalysis) {
      update((state) => ({
        ...state,
        aiAnalysis: cachedAnalysis,
        aiAnalysisTimestamp: Date.now()
      }));
      return true;
    }
    return false;
  }
  const store = {
    subscribe,
    init,
    loadGrades,
    changeQuarter,
    forceRefresh,
    clearAllCache,
    getCachedData: (studentId, quarter, schoolYear) => getCachedData2(studentId, quarter, schoolYear),
    // AI Analysis methods
    loadAiAnalysis,
    clearAiAnalysis,
    initAiAnalysis,
    getCachedAiAnalysis: (studentId, quarter, schoolYear) => getCachedAiAnalysis(studentId, quarter, schoolYear)
  };
  return store;
}
createStudentGradeStore();
const CACHE_DURATION$3 = 5 * 60 * 1e3;
const CACHE_KEY_PREFIX$3 = "student_class_ranking_";
function createStudentClassRankingStore() {
  const initialState = {
    myRank: 0,
    totalStudents: 0,
    myAverage: 0,
    sectionInfo: null,
    rankingsList: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    currentStudentId: null,
    currentQuarter: null,
    currentSchoolYear: null
  };
  const { subscribe, set, update } = writable(initialState);
  function getAuthHeaders2() {
    const authState = get(authStore);
    if (!authState?.isAuthenticated || !authState.userData) {
      return {};
    }
    const userInfo = {
      id: authState.userData.id,
      name: authState.userData.name,
      account_number: authState.userData.accountNumber,
      account_type: authState.userData.account_type || authState.userData.accountType
    };
    return {
      "x-user-info": JSON.stringify(userInfo)
    };
  }
  function getCacheKey(studentId, quarter, schoolYear) {
    return `${CACHE_KEY_PREFIX$3}${studentId}_${quarter}_${schoolYear}`;
  }
  function isCacheValid(cachedData) {
    if (!cachedData || !cachedData.timestamp) return false;
    return Date.now() - cachedData.timestamp < CACHE_DURATION$3;
  }
  function getCachedData2(studentId, quarter, schoolYear) {
    try {
      const cacheKey = getCacheKey(studentId, quarter, schoolYear);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        return parsedData.data;
      }
    } catch (error) {
      console.warn("Failed to retrieve cached class ranking data:", error);
    }
    return null;
  }
  function getValidCachedData(studentId, quarter, schoolYear) {
    try {
      const cacheKey = getCacheKey(studentId, quarter, schoolYear);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        if (isCacheValid(parsedData)) {
          return parsedData.data;
        }
      }
    } catch (error) {
      console.warn("Failed to retrieve cached class ranking data:", error);
    }
    return null;
  }
  function cacheData2(studentId, quarter, schoolYear, data) {
    try {
      const cacheKey = getCacheKey(studentId, quarter, schoolYear);
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn("Failed to cache class ranking data:", error);
    }
  }
  async function fetchRankings(studentId, quarter, schoolYear) {
    const response = await fetch(
      `/api/class-rankings?studentId=${studentId}&quarter=${quarter}&schoolYear=${schoolYear}`,
      {
        headers: getAuthHeaders2()
      }
    );
    if (!response.ok) {
      throw new Error("Failed to load class rankings");
    }
    return await response.json();
  }
  return {
    subscribe,
    // Initialize store with cached data if available
    init(studentId, quarter, schoolYear) {
      const cachedData = getValidCachedData(studentId, quarter, schoolYear);
      if (cachedData) {
        update((state) => ({
          ...state,
          ...cachedData,
          currentStudentId: studentId,
          currentQuarter: quarter,
          currentSchoolYear: schoolYear,
          isLoading: false,
          isRefreshing: false,
          error: null
        }));
        return true;
      }
      update((state) => ({
        ...state,
        currentStudentId: studentId,
        currentQuarter: quarter,
        currentSchoolYear: schoolYear,
        isLoading: true,
        isRefreshing: false,
        error: null
      }));
      return false;
    },
    // Load rankings with optional force refresh
    async loadRankings(studentId, quarter, schoolYear, forceRefresh = false) {
      if (!studentId) {
        console.warn("Student ID is required to load rankings");
        return;
      }
      update((state) => ({
        ...state,
        isLoading: state.rankingsList.length === 0 && !forceRefresh,
        isRefreshing: state.rankingsList.length > 0 || forceRefresh,
        error: null,
        currentStudentId: studentId,
        currentQuarter: quarter,
        currentSchoolYear: schoolYear
      }));
      try {
        const data = await fetchRankings(studentId, quarter, schoolYear);
        const newState = {
          myRank: data.myRank || 0,
          totalStudents: data.totalStudents || 0,
          myAverage: data.myAverage || 0,
          sectionInfo: data.sectionInfo || null,
          rankingsList: data.rankings || [],
          isLoading: false,
          isRefreshing: false,
          error: null,
          lastUpdated: Date.now(),
          currentStudentId: studentId,
          currentQuarter: quarter,
          currentSchoolYear: schoolYear
        };
        cacheData2(studentId, quarter, schoolYear, {
          myRank: newState.myRank,
          totalStudents: newState.totalStudents,
          myAverage: newState.myAverage,
          sectionInfo: newState.sectionInfo,
          rankingsList: newState.rankingsList,
          lastUpdated: newState.lastUpdated
        });
        set(newState);
      } catch (error) {
        console.error("Error loading class rankings:", error);
        const cachedData = getCachedData2(studentId, quarter, schoolYear);
        console.log("Rankings fetch failed, checking cache:", {
          hasCachedData: !!cachedData,
          studentId,
          quarter,
          schoolYear
        });
        if (cachedData) {
          console.log("Using cached rankings data and showing toast");
          update((state) => ({
            ...state,
            myRank: cachedData.myRank || 0,
            totalStudents: cachedData.totalStudents || 0,
            myAverage: cachedData.myAverage || 0,
            sectionInfo: cachedData.sectionInfo || null,
            rankingsList: cachedData.rankingsList || [],
            lastUpdated: cachedData.lastUpdated,
            isLoading: false,
            isRefreshing: false,
            error: null
            // Don't set error since we have cached data
          }));
          setTimeout(() => {
            toastStore.error("No internet connection. Showing offline data.");
          }, 100);
        } else {
          console.log("No cached data available, showing error container");
          update((state) => ({
            ...state,
            isLoading: false,
            isRefreshing: false,
            error: error.message || "Failed to load rankings"
          }));
        }
      }
    },
    // Refresh current rankings
    async refresh() {
      let currentState;
      const unsubscribe = subscribe((state) => {
        currentState = state;
      });
      unsubscribe();
      if (currentState.currentStudentId && currentState.currentQuarter && currentState.currentSchoolYear) {
        await this.loadRankings(
          currentState.currentStudentId,
          currentState.currentQuarter,
          currentState.currentSchoolYear,
          true
        );
      }
    },
    // Reset store to initial state
    reset() {
      set(initialState);
    },
    // Clear cache for specific student
    clearCache(studentId, quarter, schoolYear) {
      try {
        const cacheKey = getCacheKey(studentId, quarter, schoolYear);
        localStorage.removeItem(cacheKey);
      } catch (error) {
        console.warn("Failed to clear cache:", error);
      }
    },
    // Clear all ranking caches
    clearAllCache() {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach((key) => {
          if (key.startsWith(CACHE_KEY_PREFIX$3)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn("Failed to clear all caches:", error);
      }
    }
  };
}
createStudentClassRankingStore();
const CACHE_DURATION$2 = 5 * 60 * 1e3;
const CACHE_KEY_PREFIX$2 = "student_schedule_";
function getAuthHeaders() {
  let userInfo;
  authStore.subscribe((value) => {
    userInfo = value.userData;
  })();
  if (!userInfo) {
    console.warn("No user info available for authentication");
    return {};
  }
  return {
    "x-user-info": JSON.stringify({
      id: userInfo.id,
      name: userInfo.name,
      account_number: userInfo.accountNumber,
      account_type: userInfo.accountType
    })
  };
}
function createStudentScheduleStore() {
  const initialState = {
    scheduleData: {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: []
    },
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    currentStudentId: null
  };
  const { subscribe, set, update } = writable(initialState);
  function getCacheKey(studentId) {
    return `${CACHE_KEY_PREFIX$2}${studentId}`;
  }
  function isCacheValid(cachedData) {
    if (!cachedData || !cachedData.timestamp) return false;
    return Date.now() - cachedData.timestamp < CACHE_DURATION$2;
  }
  function getCachedData2(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        return parsedData.data;
      }
    } catch (error) {
      console.warn("Failed to retrieve cached student schedule data:", error);
    }
    return null;
  }
  function getValidCachedData(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        if (isCacheValid(parsedData)) {
          return parsedData.data;
        }
      }
    } catch (error) {
      console.warn("Failed to retrieve cached student schedule data:", error);
    }
    return null;
  }
  function cacheData2(studentId, data) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn("Failed to cache student schedule data:", error);
    }
  }
  const dayMapping = {
    "monday": "Mon",
    "tuesday": "Tue",
    "wednesday": "Wed",
    "thursday": "Thu",
    "friday": "Fri"
  };
  const slotColors = ["blue", "green", "purple", "yellow", "orange"];
  function getSlotColor(slotIndex) {
    return slotColors[slotIndex % slotColors.length];
  }
  function formatTime2(timeString) {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour.toString().padStart(2, "0")}:${minutes} ${ampm}`;
  }
  function processScheduleData2(data) {
    const processedSchedule = {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: []
    };
    const daySlotCounters = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0
    };
    data.forEach((item) => {
      const dayAbbrev = dayMapping[item.day_of_week.toLowerCase()];
      if (dayAbbrev) {
        const startTime = formatTime2(item.start_time);
        const endTime = formatTime2(item.end_time);
        let className, teacher;
        if (item.schedule_type === "subject") {
          className = item.subject_name || "Unknown Subject";
          teacher = item.teacher_name || "No Teacher Assigned";
        } else if (item.schedule_type === "activity") {
          className = item.activity_type_name || "Activity";
          teacher = item.teacher_name || "";
        }
        const classItem = {
          name: className,
          time: `${startTime} - ${endTime}`,
          room: item.room_name || "TBA",
          teacher,
          scheduleType: item.schedule_type,
          color: getSlotColor(daySlotCounters[dayAbbrev])
        };
        processedSchedule[dayAbbrev].push(classItem);
        daySlotCounters[dayAbbrev]++;
      }
    });
    return processedSchedule;
  }
  async function loadSchedule(studentId, silent = false) {
    try {
      update((state) => ({
        ...state,
        isLoading: !silent,
        isRefreshing: silent,
        error: null,
        currentStudentId: studentId
      }));
      const currentQuarterResponse = await fetch("/api/current-quarter", {
        headers: getAuthHeaders()
      });
      const currentQuarterData = await currentQuarterResponse.json();
      const schoolYear = currentQuarterData.data?.currentSchoolYear || "2025-2026";
      const response = await fetch(`/api/schedules?action=student-schedules&studentId=${studentId}&schoolYear=${schoolYear}`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch schedule data");
      }
      const processedData = processScheduleData2(result.data);
      update((state) => ({
        ...state,
        scheduleData: processedData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      }));
      cacheData2(studentId, {
        scheduleData: processedData,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("Error loading student schedule:", error);
      const cachedData = getCachedData2(studentId);
      if (cachedData) {
        update((state) => ({
          ...state,
          isLoading: false,
          isRefreshing: false,
          error: null,
          // Don't set error since we have cached data
          scheduleData: cachedData.scheduleData || {
            Mon: [],
            Tue: [],
            Wed: [],
            Thu: [],
            Fri: []
          },
          lastUpdated: cachedData.lastUpdated
        }));
        toastStore.error("No internet connection. Showing offline data.");
      } else {
        update((state) => ({
          ...state,
          isLoading: false,
          isRefreshing: false,
          error: error.message,
          scheduleData: {
            Mon: [],
            Tue: [],
            Wed: [],
            Thu: [],
            Fri: []
          }
        }));
      }
    }
  }
  function init(studentId) {
    const cachedData = getValidCachedData(studentId);
    if (cachedData) {
      update((state) => ({
        ...state,
        ...cachedData,
        currentStudentId: studentId,
        isLoading: false,
        isRefreshing: false,
        error: null
      }));
      return true;
    }
    update((state) => ({
      ...state,
      currentStudentId: studentId,
      isLoading: true,
      isRefreshing: false,
      error: null
    }));
    return false;
  }
  function forceRefresh(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn("Failed to clear student schedule cache:", error);
    }
    update((state) => ({
      ...initialState,
      currentStudentId: studentId,
      isLoading: true
    }));
    return store.loadSchedule(studentId, false);
  }
  const store = {
    subscribe,
    init,
    loadSchedule,
    forceRefresh,
    getCachedData: (studentId) => getCachedData2(studentId)
  };
  return store;
}
createStudentScheduleStore();
const CACHE_DURATION$1 = 5 * 60 * 1e3;
const CACHE_KEY_PREFIX$1 = "student_doc_requests_";
function createStudentDocumentRequestStore() {
  const initialState = {
    requestHistory: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    currentStudentId: null
  };
  const { subscribe, set, update } = writable(initialState);
  function getCacheKey(studentId) {
    return `${CACHE_KEY_PREFIX$1}${studentId}`;
  }
  function isCacheValid(cachedData) {
    if (!cachedData || !cachedData.timestamp) return false;
    return Date.now() - cachedData.timestamp < CACHE_DURATION$1;
  }
  function getCachedData2(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        return parsedData.data;
      }
    } catch (error) {
      console.warn("Failed to retrieve cached document request data:", error);
    }
    return null;
  }
  function getValidCachedData(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        if (isCacheValid(parsedData)) {
          return parsedData.data;
        }
      }
    } catch (error) {
      console.warn("Failed to retrieve cached document request data:", error);
    }
    return null;
  }
  function cacheData2(studentId, data) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn("Failed to cache document request data:", error);
    }
  }
  function mapStatusToUI(backendStatus) {
    return backendStatus;
  }
  async function loadDocumentRequests(silent = false) {
    try {
      update((state) => ({
        ...state,
        isLoading: !silent,
        isRefreshing: silent,
        error: null
      }));
      const result = await api.get("/api/document-requests?action=student");
      if (!result.success) {
        throw new Error(result.error || "Failed to load document requests");
      }
      const requestHistory = result.data.map((req) => ({
        id: req.id,
        requestId: req.requestId,
        type: req.documentType,
        purpose: req.purpose,
        status: mapStatusToUI(req.status),
        requestedDate: req.submittedDate,
        completedDate: req.completedDate,
        cancelledDate: req.cancelledDate,
        tentativeDate: req.tentativeDate,
        payment: req.payment,
        paymentAmount: req.paymentAmount,
        paymentStatus: req.paymentStatus || "pending",
        processedBy: req.processedBy,
        adminName: req.processedBy,
        adminNote: req.adminNote,
        rejectionReason: req.rejectionReason,
        messages: req.messages || [],
        lastReadAt: req.lastReadAt || null
      }));
      update((state) => ({
        ...state,
        requestHistory,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      }));
      const currentState = { requestHistory, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
      let studentId;
      update((state) => {
        studentId = state.currentStudentId;
        return state;
      });
      if (studentId) {
        cacheData2(studentId, currentState);
      }
    } catch (error) {
      console.error("Error loading document requests:", error);
      let studentId;
      update((state) => {
        studentId = state.currentStudentId;
        return state;
      });
      const cachedData = getCachedData2(studentId);
      if (cachedData) {
        update((state) => ({
          ...state,
          requestHistory: cachedData.requestHistory || [],
          lastUpdated: cachedData.lastUpdated,
          isLoading: false,
          isRefreshing: false,
          error: null
          // Don't set error since we have cached data
        }));
        toastStore.error("No internet connection. Showing offline data.");
      } else {
        update((state) => ({
          ...state,
          isLoading: false,
          isRefreshing: false,
          error: error.message,
          requestHistory: []
        }));
      }
    }
  }
  function init(studentId) {
    const cachedData = getValidCachedData(studentId);
    if (cachedData) {
      update((state) => ({
        ...state,
        ...cachedData,
        currentStudentId: studentId,
        isLoading: false,
        isRefreshing: false,
        error: null
      }));
      return true;
    }
    update((state) => ({
      ...state,
      currentStudentId: studentId,
      isLoading: true,
      isRefreshing: false,
      error: null
    }));
    return false;
  }
  async function forceRefresh(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn("Failed to clear document request cache:", error);
    }
    update((state) => ({
      ...initialState,
      currentStudentId: studentId,
      isLoading: true
    }));
    return await store.loadDocumentRequests(false);
  }
  async function submitRequest(documentType, purpose) {
    try {
      const result = await api.post("/api/document-requests", {
        action: "create",
        documentType,
        purpose: purpose.trim(),
        paymentAmount: null,
        isUrgent: false
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to submit request");
      }
      await store.loadDocumentRequests(false);
      return { success: true };
    } catch (error) {
      console.error("Error submitting document request:", error);
      return { success: false, error: error.message };
    }
  }
  async function cancelRequest(requestId) {
    try {
      const result = await api.post("/api/document-requests", {
        action: "cancel",
        requestId
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to cancel request");
      }
      await store.loadDocumentRequests(false);
      return { success: true };
    } catch (error) {
      console.error("Error cancelling document request:", error);
      return { success: false, error: error.message };
    }
  }
  async function markMessagesAsRead(requestId) {
    try {
      const result = await api.post("/api/document-requests", {
        action: "markAsRead",
        requestId
      });
      if (result.success) {
        update((state) => ({
          ...state,
          requestHistory: state.requestHistory.map(
            (req) => req.requestId === requestId ? { ...req, lastReadAt: result.data.lastReadAt } : req
          )
        }));
      }
      return { success: result.success };
    } catch (error) {
      console.error("Error marking messages as read:", error);
      return { success: false, error: error.message };
    }
  }
  async function getRequestDetails(requestId) {
    try {
      const result = await api.get(`/api/document-requests?action=single&requestId=${requestId}`);
      if (!result.success) {
        throw new Error(result.error || "Failed to load request details");
      }
      const requestData = {
        ...result.data,
        type: result.data.documentType,
        requestedDate: result.data.submittedDate,
        paymentAmount: result.data.paymentAmount,
        paymentStatus: result.data.paymentStatus ?? "pending"
      };
      return { success: true, data: requestData };
    } catch (error) {
      console.error("Error fetching request details:", error);
      return { success: false, error: error.message };
    }
  }
  const store = {
    subscribe,
    init,
    loadDocumentRequests,
    forceRefresh,
    submitRequest,
    cancelRequest,
    markMessagesAsRead,
    getRequestDetails,
    getCachedData: (studentId) => getCachedData2(studentId)
  };
  return store;
}
createStudentDocumentRequestStore();
const CACHE_DURATION = 5 * 60 * 1e3;
const CACHE_KEY_PREFIX = "student_todolist_";
function createStudentTodolistStore() {
  const initialState = {
    todos: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    currentStudentId: null
  };
  const { subscribe, set, update } = writable(initialState);
  function getCacheKey(studentId) {
    return `${CACHE_KEY_PREFIX}${studentId}`;
  }
  function isCacheValid(cachedData) {
    if (!cachedData || !cachedData.timestamp) return false;
    return Date.now() - cachedData.timestamp < CACHE_DURATION;
  }
  function getCachedData2(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        return parsedData.data;
      }
    } catch (error) {
      console.warn("Failed to retrieve cached student todolist data:", error);
    }
    return null;
  }
  function getValidCachedData(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        if (isCacheValid(parsedData)) {
          return parsedData.data;
        }
      }
    } catch (error) {
      console.warn("Failed to retrieve cached student todolist data:", error);
    }
    return null;
  }
  function cacheData2(studentId, data) {
    try {
      const cacheKey = getCacheKey(studentId);
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn("Failed to cache student todolist data:", error);
    }
  }
  async function loadTodos(studentId, silent = false) {
    try {
      update((state) => ({
        ...state,
        isLoading: !silent,
        isRefreshing: silent,
        error: null,
        currentStudentId: studentId
      }));
      const response = await api.get(`/api/student-todos?studentId=${studentId}`);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch todos");
      }
      const todos = response.data || [];
      update((state) => ({
        ...state,
        todos,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      }));
      cacheData2(studentId, {
        todos,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("Error loading student todos:", error);
      let studentId2;
      update((state) => {
        studentId2 = state.currentStudentId;
        return state;
      });
      const cachedData = getCachedData2(studentId2);
      if (cachedData) {
        update((state) => ({
          ...state,
          isLoading: false,
          isRefreshing: false,
          error: null,
          // Don't set error since we have cached data
          todos: cachedData.todos || [],
          lastUpdated: cachedData.lastUpdated
        }));
        toastStore.error("No internet connection. Showing offline data.");
      } else {
        update((state) => ({
          ...state,
          isLoading: false,
          isRefreshing: false,
          error: error.message,
          todos: []
        }));
      }
    }
  }
  async function addTodo(studentId, todoData) {
    try {
      const response = await api.post("/api/student-todos", {
        studentId,
        ...todoData
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to add todo");
      }
      update((state) => {
        const newTodos = [response.data, ...state.todos];
        cacheData2(studentId, {
          todos: newTodos,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        });
        return {
          ...state,
          todos: newTodos,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error("Error adding todo:", error);
      return { success: false, error: error.message };
    }
  }
  async function updateTodo(studentId, todoId, updateData) {
    try {
      const response = await api.put("/api/student-todos", {
        id: todoId,
        studentId,
        action: "update",
        ...updateData
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to update todo");
      }
      update((state) => {
        const newTodos = state.todos.map(
          (todo) => todo.id === todoId ? response.data : todo
        );
        cacheData2(studentId, {
          todos: newTodos,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        });
        return {
          ...state,
          todos: newTodos,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error("Error updating todo:", error);
      return { success: false, error: error.message };
    }
  }
  async function toggleTodo(studentId, todoId) {
    try {
      const response = await api.put("/api/student-todos", {
        id: todoId,
        studentId,
        action: "toggle"
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to toggle todo");
      }
      update((state) => {
        const newTodos = state.todos.map(
          (todo) => todo.id === todoId ? response.data : todo
        );
        cacheData2(studentId, {
          todos: newTodos,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        });
        return {
          ...state,
          todos: newTodos,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error("Error toggling todo:", error);
      return { success: false, error: error.message };
    }
  }
  async function deleteTodo(studentId, todoId) {
    try {
      const response = await api.delete("/api/student-todos", {
        id: todoId,
        studentId
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to delete todo");
      }
      update((state) => {
        const newTodos = state.todos.filter((todo) => todo.id !== todoId);
        cacheData2(studentId, {
          todos: newTodos,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        });
        return {
          ...state,
          todos: newTodos,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting todo:", error);
      return { success: false, error: error.message };
    }
  }
  function init(studentId) {
    const cachedData = getValidCachedData(studentId);
    if (cachedData) {
      update((state) => ({
        ...state,
        ...cachedData,
        currentStudentId: studentId,
        isLoading: false,
        isRefreshing: false,
        error: null
      }));
      return true;
    }
    update((state) => ({
      ...state,
      currentStudentId: studentId,
      isLoading: true,
      isRefreshing: false,
      error: null
    }));
    return false;
  }
  function forceRefresh(studentId) {
    try {
      const cacheKey = getCacheKey(studentId);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn("Failed to clear student todolist cache:", error);
    }
    update((state) => ({
      ...initialState,
      currentStudentId: studentId,
      isLoading: true
    }));
    return store.loadTodos(studentId, false);
  }
  const store = {
    subscribe,
    init,
    loadTodos,
    addTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    forceRefresh,
    getCachedData: (studentId) => getCachedData2(studentId)
  };
  return store;
}
createStudentTodolistStore();
const CACHE_KEY$2 = "teacherProfileCache";
const CACHE_VALIDITY_MS$3 = 5 * 60 * 1e3;
function createTeacherProfileStore() {
  const { subscribe, set, update } = writable({
    teacherData: null,
    teacherProfileData: null,
    teacherSections: [],
    isLoading: false,
    isRefreshing: false,
    // For silent background refresh
    error: null,
    lastUpdated: null,
    isInitialized: false
  });
  const store = {
    subscribe,
    // Initialize store with cached data (immediate display)
    init: (teacherId) => {
      const cachedData = getCachedData$1(teacherId);
      if (cachedData) {
        update((state) => ({
          ...state,
          teacherData: cachedData.teacherData,
          teacherProfileData: cachedData.teacherProfileData,
          teacherSections: cachedData.teacherSections,
          lastUpdated: cachedData.lastUpdated,
          isInitialized: true,
          isLoading: false,
          error: null
        }));
        return true;
      }
      return false;
    },
    // Set loading state (only for initial load if no cache)
    setLoading: (loading, silent = false) => {
      update((state) => ({
        ...state,
        isLoading: loading && !state.isInitialized && !silent,
        isRefreshing: loading && silent,
        error: loading ? null : state.error
      }));
    },
    // Set error state
    setError: (errorMessage) => {
      update((state) => ({
        ...state,
        isLoading: false,
        isRefreshing: false,
        error: errorMessage
      }));
    },
    // Update profile data and cache it
    updateProfileData: (teacherData, teacherProfileData, teacherSections, teacherId) => {
      const timestamp = Date.now();
      update((state) => ({
        ...state,
        teacherData,
        teacherProfileData,
        teacherSections,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: timestamp,
        isInitialized: true
      }));
      cacheData$1(teacherData, teacherProfileData, teacherSections, teacherId, timestamp);
    },
    // Load profile data with caching support
    loadProfile: async (teacherId, silent = false) => {
      try {
        update((state) => ({
          ...state,
          isLoading: !silent && !state.isInitialized,
          isRefreshing: silent,
          error: null
        }));
        const response = await api.get(`/api/accounts?type=teacher&limit=1000`);
        if (!response.success) {
          throw new Error(response.message || "Failed to fetch teacher data");
        }
        const currentUserData = response.accounts.find(
          (account) => account.id === teacherId || account.number === teacherId
        );
        if (!currentUserData) {
          throw new Error("Teacher data not found");
        }
        let teacherProfileData = null;
        try {
          const profileResponse = await api.get(`/api/teacher-profile?teacherId=${teacherId}`);
          if (profileResponse.success) {
            teacherProfileData = profileResponse.data;
          }
        } catch (err) {
          console.warn("Failed to fetch teacher profile data:", err);
        }
        let teacherSections = [];
        try {
          const currentQuarterResponse = await fetch("/api/current-quarter");
          const currentQuarterData = await currentQuarterResponse.json();
          const schoolYear = currentQuarterData.data?.currentSchoolYear || "2025-2026";
          const sectionsResponse = await fetch(`/api/teacher-sections?teacherId=${teacherId}&schoolYear=${schoolYear}`);
          if (sectionsResponse.ok) {
            const result = await sectionsResponse.json();
            if (result.success) {
              teacherSections = result.data.classData || [];
            }
          }
        } catch (err) {
          console.warn("Failed to fetch teacher sections:", err);
        }
        store.updateProfileData(currentUserData, teacherProfileData, teacherSections, teacherId);
      } catch (error) {
        console.error("Error loading teacher profile:", error);
        update((state) => ({
          ...state,
          isLoading: false,
          isRefreshing: false,
          error: error.message
        }));
      }
    },
    // Clear cache
    clearCache: (teacherId) => {
      try {
        const cacheKey = `${CACHE_KEY$2}_${teacherId}`;
        localStorage.removeItem(cacheKey);
      } catch (error) {
        console.warn("Failed to clear teacher profile cache:", error);
      }
    },
    // Force refresh (clear cache and reload)
    forceRefresh: async (teacherId) => {
      store.clearCache(teacherId);
      update((state) => ({
        ...state,
        isInitialized: false,
        teacherData: null,
        teacherProfileData: null,
        teacherSections: []
      }));
      await store.loadProfile(teacherId, false);
    }
  };
  return store;
}
function getCachedData$1(teacherId) {
  try {
    const cacheKey = `${CACHE_KEY$2}_${teacherId}`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    const data = JSON.parse(cached);
    const now = Date.now();
    if (now - data.timestamp > CACHE_VALIDITY_MS$3) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return {
      teacherData: data.teacherData,
      teacherProfileData: data.teacherProfileData,
      teacherSections: data.teacherSections,
      lastUpdated: data.timestamp
    };
  } catch (error) {
    console.warn("Failed to get cached teacher profile data:", error);
    return null;
  }
}
function cacheData$1(teacherData, teacherProfileData, teacherSections, teacherId, timestamp) {
  try {
    const cacheKey = `${CACHE_KEY$2}_${teacherId}`;
    const dataToCache = {
      teacherData,
      teacherProfileData,
      teacherSections,
      timestamp
    };
    localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
  } catch (error) {
    console.warn("Failed to cache teacher profile data:", error);
  }
}
createTeacherProfileStore();
const CACHE_KEY$1 = "teacherScheduleCache";
const CACHE_VALIDITY_MS$2 = 5 * 60 * 1e3;
function createTeacherScheduleStore() {
  const { subscribe, set, update } = writable({
    scheduleData: {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: []
    },
    isLoading: false,
    isRefreshing: false,
    // For silent background refresh
    error: null,
    lastUpdated: null,
    isInitialized: false
  });
  const store = {
    subscribe,
    // Initialize store with cached data (immediate display)
    init: (teacherId, schoolYear) => {
      const cachedData = getCachedData(teacherId, schoolYear);
      if (cachedData) {
        update((state) => ({
          ...state,
          scheduleData: cachedData.scheduleData,
          lastUpdated: cachedData.lastUpdated,
          isInitialized: true,
          isLoading: false,
          error: null
        }));
        return true;
      }
      return false;
    },
    // Set loading state (only for initial load if no cache)
    setLoading: (loading, silent = false) => {
      update((state) => ({
        ...state,
        isLoading: loading && !state.isInitialized && !silent,
        isRefreshing: loading && silent,
        error: loading ? null : state.error
      }));
    },
    // Update schedule data and cache it
    updateScheduleData: (newScheduleData, teacherId, schoolYear, silent = false) => {
      const now = Date.now();
      update((state) => ({
        ...state,
        scheduleData: newScheduleData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: now,
        isInitialized: true
      }));
      cacheData(newScheduleData, teacherId, schoolYear, now);
    },
    // Set error state
    setError: (error, silent = false) => {
      update((state) => ({
        ...state,
        error,
        isLoading: false,
        isRefreshing: false
      }));
    },
    // Load schedule data with caching support
    loadSchedule: async (teacherId, schoolYear, silent = false) => {
      try {
        update((state) => ({
          ...state,
          isLoading: !silent && !state.isInitialized,
          isRefreshing: silent,
          error: null
        }));
        let currentSchoolYear = schoolYear;
        if (!currentSchoolYear) {
          const currentQuarterResponse = await authenticatedFetch("/api/current-quarter");
          const currentQuarterData = await currentQuarterResponse.json();
          currentSchoolYear = currentQuarterData.data?.currentSchoolYear || "2025-2026";
        }
        const response = await authenticatedFetch(`/api/schedules?action=teacher-schedules&teacherId=${teacherId}&schoolYear=${currentSchoolYear}`);
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to fetch schedule data");
        }
        const processedData = processScheduleData(result.data);
        update((state) => ({
          ...state,
          scheduleData: processedData,
          isLoading: false,
          isRefreshing: false,
          error: null,
          lastUpdated: Date.now(),
          isInitialized: true
        }));
        cacheData(processedData, teacherId, currentSchoolYear, Date.now());
      } catch (error) {
        console.error("Error loading teacher schedule:", error);
        update((state) => ({
          ...state,
          error: error.message,
          isLoading: false,
          isRefreshing: false
        }));
      }
    },
    // Clear cache
    clearCache: (teacherId, schoolYear) => {
      try {
        const cacheKey = `${CACHE_KEY$1}_${teacherId}_${schoolYear}`;
        localStorage.removeItem(cacheKey);
      } catch (error) {
        console.warn("Failed to clear teacher schedule cache:", error);
      }
    },
    // Force refresh (clear cache and reload)
    forceRefresh: async (teacherId, schoolYear) => {
      try {
        const cacheKey = `${CACHE_KEY$1}_${teacherId}_${schoolYear}`;
        localStorage.removeItem(cacheKey);
      } catch (error) {
        console.warn("Failed to clear cache during force refresh:", error);
      }
      update((state) => ({
        ...state,
        isInitialized: false,
        scheduleData: {
          Mon: [],
          Tue: [],
          Wed: [],
          Thu: [],
          Fri: []
        }
      }));
      await store.loadSchedule(teacherId, schoolYear, false);
    }
  };
  return store;
}
function getCachedData(teacherId, schoolYear) {
  try {
    const cacheKey = `${CACHE_KEY$1}_${teacherId}_${schoolYear}`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    const data = JSON.parse(cached);
    const now = Date.now();
    if (now - data.timestamp > CACHE_VALIDITY_MS$2) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return {
      scheduleData: data.scheduleData,
      lastUpdated: data.timestamp
    };
  } catch (error) {
    console.warn("Failed to retrieve cached teacher schedule:", error);
    return null;
  }
}
function cacheData(scheduleData, teacherId, schoolYear, timestamp) {
  try {
    const cacheKey = `${CACHE_KEY$1}_${teacherId}_${schoolYear}`;
    const cacheData2 = {
      scheduleData,
      timestamp,
      teacherId,
      schoolYear
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData2));
  } catch (error) {
    console.warn("Failed to cache teacher schedule data:", error);
  }
}
function processScheduleData(data) {
  const processedSchedule = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: []
  };
  const dayMapping = {
    "monday": "Mon",
    "tuesday": "Tue",
    "wednesday": "Wed",
    "thursday": "Thu",
    "friday": "Fri"
  };
  const slotColors = ["blue", "green", "purple", "yellow", "orange"];
  function getSlotColor(slotIndex) {
    return slotColors[slotIndex % slotColors.length];
  }
  const daySlotCounters = {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0
  };
  data.forEach((item) => {
    const dayAbbrev = dayMapping[item.day_of_week.toLowerCase()];
    if (dayAbbrev) {
      const startTime = formatTime(item.start_time);
      const endTime = formatTime(item.end_time);
      let className, subject;
      if (item.schedule_type === "subject") {
        className = item.section_name;
        subject = item.subject_name || "Unknown Subject";
      } else if (item.schedule_type === "activity") {
        className = item.activity_type_name || "Activity";
        subject = item.activity_type_name || "Activity";
      }
      const classItem = {
        name: className,
        time: `${startTime} - ${endTime}`,
        room: item.room_name || "TBA",
        subject,
        gradeLevel: item.grade_level,
        scheduleType: item.schedule_type,
        color: getSlotColor(daySlotCounters[dayAbbrev])
      };
      processedSchedule[dayAbbrev].push(classItem);
      daySlotCounters[dayAbbrev]++;
    }
  });
  Object.keys(processedSchedule).forEach((day) => {
    const classes = processedSchedule[day];
    const vacantTimes = detectVacantTimes(classes);
    const combinedSchedule = [...classes, ...vacantTimes].sort((a, b) => {
      const aStartTime = timeToMinutes(a.time.split(" - ")[0]);
      const bStartTime = timeToMinutes(b.time.split(" - ")[0]);
      return aStartTime - bStartTime;
    });
    processedSchedule[day] = combinedSchedule;
  });
  return processedSchedule;
}
function formatTime(timeString) {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour.toString().padStart(2, "0")}:${minutes} ${ampm}`;
}
function timeToMinutes(timeString) {
  const [time, period] = timeString.split(" ");
  const [hours, minutes] = time.split(":").map(Number);
  let totalMinutes = minutes;
  if (period === "PM" && hours !== 12) {
    totalMinutes += (hours + 12) * 60;
  } else if (period === "AM" && hours === 12) {
    totalMinutes += 0;
  } else {
    totalMinutes += hours * 60;
  }
  return totalMinutes;
}
function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}
function detectVacantTimes(classes) {
  if (classes.length <= 1) return [];
  const sortedClasses = [...classes].sort((a, b) => {
    const aStartTime = timeToMinutes(a.time.split(" - ")[0]);
    const bStartTime = timeToMinutes(b.time.split(" - ")[0]);
    return aStartTime - bStartTime;
  });
  const vacantTimes = [];
  for (let i = 0; i < sortedClasses.length - 1; i++) {
    const currentClass = sortedClasses[i];
    const nextClass = sortedClasses[i + 1];
    const currentEndTime = timeToMinutes(currentClass.time.split(" - ")[1]);
    const nextStartTime = timeToMinutes(nextClass.time.split(" - ")[0]);
    if (nextStartTime > currentEndTime) {
      const vacantStartTime = minutesToTime(currentEndTime);
      const vacantEndTime = minutesToTime(nextStartTime);
      vacantTimes.push({
        name: "Vacant Time",
        time: `${vacantStartTime} - ${vacantEndTime}`,
        room: "Available",
        subject: "Free Period",
        color: "gray",
        isVacant: true
      });
    }
  }
  return vacantTimes;
}
createTeacherScheduleStore();
function createDashboardStore() {
  const { subscribe, set, update } = writable({
    data: [
      { id: "students", label: "Total Students", value: 0, icon: "school", color: "blue" },
      { id: "teachers", label: "Total Teachers", value: 0, icon: "person", color: "green" },
      { id: "sections", label: "Total Sections", value: 0, icon: "class", color: "orange" },
      { id: "rooms", label: "Total Rooms", value: 0, icon: "meeting_room", color: "purple" }
    ],
    isLoading: false,
    error: null,
    lastUpdated: null,
    isInitialized: false,
    // Chart data
    charts: {
      studentsPerGrade: {
        data: null,
        isLoading: false,
        error: null,
        lastUpdated: null
      },
      sectionsPerGrade: {
        data: null,
        isLoading: false,
        error: null,
        lastUpdated: null
      }
    }
  });
  return {
    subscribe,
    // Initialize with cached data (show immediately)
    init: (cachedData) => {
      if (cachedData) {
        update((state) => ({
          ...state,
          data: cachedData,
          isInitialized: true,
          isLoading: false
        }));
      }
    },
    // Set loading state (only for initial load if no cache)
    setLoading: (loading) => {
      update((state) => ({
        ...state,
        isLoading: loading && !state.isInitialized
      }));
    },
    // Update data silently (background refresh)
    updateData: (newData) => {
      update((state) => ({
        ...state,
        data: newData,
        isLoading: false,
        error: null,
        lastUpdated: /* @__PURE__ */ new Date(),
        isInitialized: true
      }));
      try {
        localStorage.setItem("dashboard-stats-cache", JSON.stringify({
          data: newData,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn("Failed to cache dashboard data:", e);
      }
    },
    // Set error state
    setError: (error) => {
      update((state) => ({
        ...state,
        error,
        isLoading: false
      }));
    },
    // Get cached data from localStorage
    getCachedData: () => {
      try {
        const cached = localStorage.getItem("dashboard-stats-cache");
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1e3) {
            return data;
          }
        }
      } catch (e) {
        console.warn("Failed to retrieve cached dashboard data:", e);
      }
      return null;
    },
    // Clear cache
    clearCache: () => {
      try {
        localStorage.removeItem("dashboard-stats-cache");
        localStorage.removeItem("dashboard-charts-cache");
      } catch (e) {
        console.warn("Failed to clear dashboard cache:", e);
      }
    },
    // ========== CHART DATA METHODS ==========
    // Initialize chart data with cached data
    initChartData: (chartType, cachedData) => {
      if (cachedData) {
        update((state) => ({
          ...state,
          charts: {
            ...state.charts,
            [chartType]: {
              ...state.charts[chartType],
              data: cachedData,
              isLoading: false
            }
          }
        }));
      }
    },
    // Set chart loading state
    setChartLoading: (chartType, loading) => {
      update((state) => ({
        ...state,
        charts: {
          ...state.charts,
          [chartType]: {
            ...state.charts[chartType],
            isLoading: loading
          }
        }
      }));
    },
    // Update chart data
    updateChartData: (chartType, newData) => {
      update((state) => ({
        ...state,
        charts: {
          ...state.charts,
          [chartType]: {
            data: newData,
            isLoading: false,
            error: null,
            lastUpdated: /* @__PURE__ */ new Date()
          }
        }
      }));
      try {
        const cacheKey = `dashboard-chart-${chartType}-cache`;
        localStorage.setItem(cacheKey, JSON.stringify({
          data: newData,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn(`Failed to cache ${chartType} data:`, e);
      }
    },
    // Set chart error
    setChartError: (chartType, error) => {
      update((state) => ({
        ...state,
        charts: {
          ...state.charts,
          [chartType]: {
            ...state.charts[chartType],
            error,
            isLoading: false
          }
        }
      }));
    },
    // Get cached chart data
    getCachedChartData: (chartType) => {
      try {
        const cacheKey = `dashboard-chart-${chartType}-cache`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1e3) {
            return data;
          }
        }
      } catch (e) {
        console.warn(`Failed to retrieve cached ${chartType} data:`, e);
      }
      return null;
    }
  };
}
createDashboardStore();
function createStudentMasterlistStore() {
  const { subscribe, set, update } = writable({
    students: [],
    sections: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    isInitialized: false
  });
  return {
    subscribe,
    // Initialize with cached data (show immediately)
    init: (cachedData) => {
      if (cachedData) {
        update((state) => ({
          ...state,
          students: cachedData.students || [],
          sections: cachedData.sections || [],
          isInitialized: true,
          isLoading: false
        }));
      }
    },
    // Set loading state (only for initial load if no cache)
    setLoading: (loading) => {
      update((state) => ({
        ...state,
        isLoading: loading && !state.isInitialized
      }));
    },
    // Update students data silently (background refresh)
    updateStudents: (newStudents) => {
      update((state) => {
        const newState = {
          ...state,
          students: newStudents,
          isLoading: false,
          error: null,
          lastUpdated: /* @__PURE__ */ new Date(),
          isInitialized: true
        };
        try {
          localStorage.setItem("student-masterlist-cache", JSON.stringify({
            students: newStudents,
            sections: state.sections,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn("Failed to cache student masterlist data:", e);
        }
        return newState;
      });
    },
    // Update sections data
    updateSections: (newSections) => {
      update((state) => {
        const newState = {
          ...state,
          sections: newSections
        };
        try {
          localStorage.setItem("student-masterlist-cache", JSON.stringify({
            students: state.students,
            sections: newSections,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn("Failed to cache sections data:", e);
        }
        return newState;
      });
    },
    // Set error state
    setError: (error) => {
      update((state) => ({
        ...state,
        error,
        isLoading: false
      }));
    },
    // Get cached data from localStorage
    getCachedData: () => {
      try {
        const cached = localStorage.getItem("student-masterlist-cache");
        if (cached) {
          const { students, sections, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1e3) {
            return { students, sections };
          }
        }
      } catch (e) {
        console.warn("Failed to retrieve cached student masterlist data:", e);
      }
      return null;
    },
    // Clear cache
    clearCache: () => {
      try {
        localStorage.removeItem("student-masterlist-cache");
      } catch (e) {
        console.warn("Failed to clear student masterlist cache:", e);
      }
    },
    // Refresh data (force refresh)
    refresh: async (fetchStudentsFn, fetchSectionsFn) => {
      update((state) => ({ ...state, isLoading: true }));
      await Promise.all([fetchStudentsFn(), fetchSectionsFn()]);
    }
  };
}
createStudentMasterlistStore();
function createTeacherMasterlistStore() {
  const { subscribe, set, update } = writable({
    teachers: [],
    departments: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    isInitialized: false
  });
  return {
    subscribe,
    // Initialize with cached data (show immediately)
    init: (cachedData) => {
      if (cachedData) {
        update((state) => ({
          ...state,
          teachers: cachedData.teachers || [],
          departments: cachedData.departments || [],
          isInitialized: true,
          isLoading: false
        }));
      }
    },
    // Set loading state (only for initial load if no cache)
    setLoading: (loading) => {
      update((state) => ({
        ...state,
        isLoading: loading && !state.isInitialized
      }));
    },
    // Update teachers data silently (background refresh)
    updateTeachers: (newTeachers) => {
      update((state) => {
        const newState = {
          ...state,
          teachers: newTeachers,
          isLoading: false,
          error: null,
          lastUpdated: /* @__PURE__ */ new Date(),
          isInitialized: true
        };
        try {
          localStorage.setItem("teacher-masterlist-cache", JSON.stringify({
            teachers: newTeachers,
            departments: state.departments,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn("Failed to cache teacher masterlist data:", e);
        }
        return newState;
      });
    },
    // Update departments data
    updateDepartments: (newDepartments) => {
      update((state) => {
        const newState = {
          ...state,
          departments: newDepartments
        };
        try {
          localStorage.setItem("teacher-masterlist-cache", JSON.stringify({
            teachers: state.teachers,
            departments: newDepartments,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn("Failed to cache departments data:", e);
        }
        return newState;
      });
    },
    // Set error state
    setError: (error) => {
      update((state) => ({
        ...state,
        error,
        isLoading: false
      }));
    },
    // Get cached data from localStorage
    getCachedData: () => {
      try {
        const cached = localStorage.getItem("teacher-masterlist-cache");
        if (cached) {
          const { teachers, departments, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1e3) {
            return { teachers, departments };
          }
        }
      } catch (e) {
        console.warn("Failed to retrieve cached teacher masterlist data:", e);
      }
      return null;
    },
    // Clear cache
    clearCache: () => {
      try {
        localStorage.removeItem("teacher-masterlist-cache");
      } catch (e) {
        console.warn("Failed to clear teacher masterlist cache:", e);
      }
    },
    // Refresh data (force refresh)
    refresh: async (fetchTeachersFn, fetchDepartmentsFn) => {
      update((state) => ({ ...state, isLoading: true }));
      await Promise.all([fetchTeachersFn(), fetchDepartmentsFn()]);
    }
  };
}
createTeacherMasterlistStore();
const CACHE_KEY = "roomManagementData";
const SECTIONS_CACHE_KEY$1 = "availableSectionsData";
const CACHE_VALIDITY_MS$1 = 5 * 60 * 1e3;
function createRoomManagementStore() {
  const { subscribe, set, update } = writable({
    rooms: [],
    availableSections: [],
    isLoading: false,
    error: null,
    lastUpdated: null
  });
  return {
    subscribe,
    // Initialize store with cached data
    init: (cachedData) => {
      if (cachedData && cachedData.rooms) {
        set({
          rooms: cachedData.rooms,
          availableSections: cachedData.availableSections || [],
          isLoading: false,
          error: null,
          lastUpdated: cachedData.lastUpdated
        });
      }
    },
    // Set loading state
    setLoading: (loading) => {
      update((state) => ({
        ...state,
        isLoading: loading,
        error: loading ? null : state.error
      }));
    },
    // Update rooms data and cache it
    updateRooms: (rooms) => {
      const now = Date.now();
      const newState = {
        rooms,
        lastUpdated: now,
        isLoading: false,
        error: null
      };
      update((state) => ({
        ...state,
        ...newState
      }));
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          rooms,
          lastUpdated: now
        }));
      } catch (error) {
        console.warn("Failed to cache rooms data:", error);
      }
    },
    // Update available sections data and cache it
    updateSections: (sections) => {
      const now = Date.now();
      update((state) => ({
        ...state,
        availableSections: sections,
        lastUpdated: now
      }));
      try {
        localStorage.setItem(SECTIONS_CACHE_KEY$1, JSON.stringify({
          sections,
          lastUpdated: now
        }));
      } catch (error) {
        console.warn("Failed to cache sections data:", error);
      }
    },
    // Set error state
    setError: (error) => {
      update((state) => ({
        ...state,
        error,
        isLoading: false
      }));
    },
    // Get cached data if valid
    getCachedData: () => {
      try {
        const roomsCache = localStorage.getItem(CACHE_KEY);
        const sectionsCache = localStorage.getItem(SECTIONS_CACHE_KEY$1);
        if (!roomsCache) return null;
        const roomsData = JSON.parse(roomsCache);
        const sectionsData = sectionsCache ? JSON.parse(sectionsCache) : { sections: [] };
        const now = Date.now();
        const roomsAge = now - (roomsData.lastUpdated || 0);
        const sectionsAge = now - (sectionsData.lastUpdated || 0);
        if (roomsAge < CACHE_VALIDITY_MS$1) {
          return {
            rooms: roomsData.rooms || [],
            availableSections: sectionsAge < CACHE_VALIDITY_MS$1 ? sectionsData.sections || [] : [],
            lastUpdated: roomsData.lastUpdated
          };
        }
        return null;
      } catch (error) {
        console.warn("Failed to retrieve cached room data:", error);
        return null;
      }
    },
    // Clear cache
    clearCache: () => {
      try {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(SECTIONS_CACHE_KEY$1);
      } catch (error) {
        console.warn("Failed to clear room cache:", error);
      }
    },
    // Add a new room to the store
    addRoom: (room) => {
      update((state) => {
        const newRooms = [room, ...state.rooms];
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            rooms: newRooms,
            lastUpdated: Date.now()
          }));
        } catch (error) {
          console.warn("Failed to update cache after adding room:", error);
        }
        return {
          ...state,
          rooms: newRooms
        };
      });
    },
    // Remove a room from the store
    removeRoom: (roomId) => {
      update((state) => {
        const newRooms = state.rooms.filter((room) => room.id !== roomId);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            rooms: newRooms,
            lastUpdated: Date.now()
          }));
        } catch (error) {
          console.warn("Failed to update cache after removing room:", error);
        }
        return {
          ...state,
          rooms: newRooms
        };
      });
    },
    // Update a specific room in the store
    updateRoom: (roomId, updatedRoom) => {
      update((state) => {
        const newRooms = state.rooms.map(
          (room) => room.id === roomId ? { ...room, ...updatedRoom } : room
        );
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            rooms: newRooms,
            lastUpdated: Date.now()
          }));
        } catch (error) {
          console.warn("Failed to update cache after updating room:", error);
        }
        return {
          ...state,
          rooms: newRooms
        };
      });
    }
  };
}
createRoomManagementStore();
const SECTIONS_CACHE_KEY = "sectionsCache";
const CACHE_VALIDITY_MS = 3 * 60 * 1e3;
(() => {
  const sections = writable([]);
  const isLoadingSections = writable(false);
  const sectionsError = writable(null);
  const getCachedSections = () => {
    try {
      const cached = localStorage.getItem(SECTIONS_CACHE_KEY);
      if (!cached) return null;
      const data = JSON.parse(cached);
      const now = Date.now();
      if (now - data.timestamp > CACHE_VALIDITY_MS) {
        localStorage.removeItem(SECTIONS_CACHE_KEY);
        return null;
      }
      return data.sections;
    } catch (error) {
      console.error("Error reading sections cache:", error);
      localStorage.removeItem(SECTIONS_CACHE_KEY);
      return null;
    }
  };
  const setCachedSections = (sectionsData) => {
    try {
      const cacheData2 = {
        sections: sectionsData,
        timestamp: Date.now()
      };
      localStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify(cacheData2));
    } catch (error) {
      console.error("Error setting sections cache:", error);
    }
  };
  const clearSectionsCache = () => {
    try {
      localStorage.removeItem(SECTIONS_CACHE_KEY);
    } catch (error) {
      console.error("Error clearing sections cache:", error);
    }
  };
  const initSections = () => {
    const cachedSections = getCachedSections();
    if (cachedSections) {
      sections.set(cachedSections);
      return true;
    }
    return false;
  };
  const updateSections = (newSections, silent = false) => {
    sections.set(newSections);
    sectionsError.set(null);
    if (!silent) {
      isLoadingSections.set(false);
    }
    setCachedSections(newSections);
  };
  const setLoadingSections = (loading, silent = false) => {
    if (!silent) {
      isLoadingSections.set(loading);
    }
  };
  const setSectionsError = (error) => {
    sectionsError.set(error);
    isLoadingSections.set(false);
  };
  const loadSections = async (silent = false, searchTerm = "") => {
    try {
      setLoadingSections(true, silent);
      let url = "/api/sections";
      if (searchTerm && searchTerm.trim()) {
        url += `?search=${encodeURIComponent(searchTerm.trim())}`;
      }
      const response = await authenticatedFetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error("Invalid API response structure");
      }
      const processedSections = result.data.map((section) => ({
        ...section,
        students: section.students || [],
        adviser: section.adviser || null
      }));
      updateSections(processedSections, silent);
    } catch (error) {
      console.error("Error loading sections:", error);
      setSectionsError(error.message);
    } finally {
      setLoadingSections(false, false);
    }
  };
  const addSection = (newSection) => {
    sections.update((currentSections) => {
      const updated = [...currentSections, newSection];
      setCachedSections(updated);
      return updated;
    });
  };
  const updateSection = (sectionId, updatedSection) => {
    sections.update((currentSections) => {
      const updated = currentSections.map(
        (section) => section.id === sectionId ? { ...section, ...updatedSection } : section
      );
      setCachedSections(updated);
      return updated;
    });
  };
  const removeSection = (sectionId) => {
    sections.update((currentSections) => {
      const updated = currentSections.filter((section) => section.id !== sectionId);
      setCachedSections(updated);
      return updated;
    });
  };
  return {
    // Stores
    sections: { subscribe: sections.subscribe },
    isLoadingSections: { subscribe: isLoadingSections.subscribe },
    sectionsError: { subscribe: sectionsError.subscribe },
    // Methods
    initSections,
    loadSections,
    updateSections,
    setLoadingSections,
    setSectionsError,
    addSection,
    updateSection,
    removeSection,
    clearSectionsCache
  };
})();
function _page($$payload, $$props) {
  push();
  let pageTitle = "Login - High School Student Information System";
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>${escape_html(pageTitle)}</title>`;
    $$payload2.out.push(`<meta name="description" content="High School Student Information System"/>`);
  });
  $$payload.out.push(`<div class="app-container">`);
  {
    $$payload.out.push("<!--[-->");
    Loginpage($$payload);
  }
  $$payload.out.push(`<!--]--></div>`);
  pop();
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DEFtPUuG.js.map
