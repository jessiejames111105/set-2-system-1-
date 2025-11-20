<script>
  import './studentNotification.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { authenticatedFetch } from '../../../../../routes/api/helper/api-helper.js';
  import { authStore } from '../../../../login/js/auth.js';
  import { modalStore } from '../../../../common/js/modalStore.js';
  import { toastStore } from '../../../../common/js/toastStore.js';
  import { studentNotificationStore } from '../../../../../lib/stores/student/studentNotificationStore.js';

  // Props - navigation callback
  let { onnavigate } = $props();

  // State variables from store
  let notifications = $derived($studentNotificationStore.notifications);
  let loading = $derived($studentNotificationStore.isLoading);
  let error = $derived($studentNotificationStore.error);
  let unreadCount = $derived($studentNotificationStore.unreadCount);
  let totalCount = $derived($studentNotificationStore.totalCount);

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Notifications', icon: 'notifications' },
    { value: 'unread', label: 'Unread Only', icon: 'mark_email_unread' },
    { value: 'grade', label: 'Grades', icon: 'grade' },
    { value: 'document', label: 'Document Requests', icon: 'description' }
  ];

  // State
  let selectedFilter = $state('all');
  let isFilterDropdownOpen = $state(false);


  // Functions
  function toggleFilterDropdown() {
    isFilterDropdownOpen = !isFilterDropdownOpen;
  }

  function selectFilter(filter) {
    selectedFilter = filter;
    isFilterDropdownOpen = false;
    studentNotificationStore.setFilter(filter);
    fetchNotifications(); // Refetch with new filter
  }

  function handleClickOutside(event) {
    if (!event.target.closest('.filter-dropdown')) {
      isFilterDropdownOpen = false;
    }
  }

  function toggleNotificationRead(id) {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      updateNotificationStatus(id, !notification.isRead);
    } else {
      console.warn('Notification not found for toggle:', id);
    }
  }

  function deleteNotification(id) {
    const notification = notifications.find(n => n.id === id);
    const notificationTitle = notification ? notification.title : 'this notification';
    
    modalStore.confirm(
      'Delete Notification',
      `<p>Are you sure you want to delete <strong>"${notificationTitle}"</strong>?</p>
       <p style="margin-top: 8px; color: var(--md-sys-color-on-surface-variant); font-size: 0.9rem;">This action cannot be undone.</p>`,
      async () => {
        await deleteNotificationAPI(id);
        toastStore.success('Notification deleted successfully');
      },
      () => {
        // Do nothing on cancel
      },
      { size: 'small' }
    );
  }

  function markAllAsRead() {
    markAllAsReadAPI();
  }

  function clearAllRead() {
    const readCount = notifications.filter(n => n.isRead).length;
    
    modalStore.confirm(
      'Clear All Read Notifications',
      `<p>Are you sure you want to delete all <strong>${readCount}</strong> read notification${readCount !== 1 ? 's' : ''}?</p>
       <p style="margin-top: 8px; color: var(--md-sys-color-on-surface-variant); font-size: 0.9rem;">This action cannot be undone.</p>`,
      async () => {
        await clearAllReadAPI();
        toastStore.success(`${readCount} read notification${readCount !== 1 ? 's' : ''} cleared successfully`);
      },
      () => {
        // Do nothing on cancel
      },
      { size: 'small' }
    );
  }

  function handleNotificationClick(notification) {
    // Navigate to document requests page for document request notifications
    // Handle both 'document' and 'document_request' types (database can have either)
    if (notification.type === 'document' || notification.type === 'document_request') {
      const requestId = notification.metadata?.relatedId;
      
      if (onnavigate) {
        onnavigate({ detail: { section: 'documents', requestId } });
      }
    }
  }

  // Helper functions

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
    }
  }

  function getFilterLabel(value) {
    const filter = filterOptions.find(f => f.value === value);
    return filter ? filter.label : 'All Notifications';
  }

  function getFilterIcon(value) {
    const filter = filterOptions.find(f => f.value === value);
    return filter ? filter.icon : 'notifications';
  }

  // API Functions
  async function fetchNotifications() {
    const user = $authStore.userData;
    
    if (!user?.id) {
      error = 'User not authenticated';
      return;
    }

    await studentNotificationStore.loadNotifications(user.id, selectedFilter);
  }

  async function updateNotificationStatus(id, isRead) {
    const user = $authStore.userData;
    if (!user?.id) return;

    await studentNotificationStore.updateNotificationStatus(user.id, id, isRead);
  }

  async function deleteNotificationAPI(id) {
    const user = $authStore.userData;
    if (!user?.id) return;

    await studentNotificationStore.deleteNotification(user.id, id);
  }

  async function markAllAsReadAPI() {
    const user = $authStore.userData;
    if (!user?.id) return;

    await studentNotificationStore.markAllAsRead(user.id);
  }

  async function clearAllReadAPI() {
    const user = $authStore.userData;
    if (!user?.id) return;

    await studentNotificationStore.clearAllRead(user.id);
  }

  // Initialize component
  onMount(() => {
    if (browser && $authStore.userData?.id) {
      const user = $authStore.userData;
      studentNotificationStore.init(user.id, selectedFilter);
      fetchNotifications();
    }
  });

  // Reactive statements
  let filteredNotifications = $derived((() => {
    // Ensure notifications is always an array
    if (!Array.isArray(notifications)) {
      return [];
    }
    
    if (selectedFilter === 'all') {
      return notifications;
    } else if (selectedFilter === 'unread') {
      return notifications.filter(n => !n.isRead);
    } else {
      return notifications.filter(n => n.type === selectedFilter);
    }
  })());
  
  // Animation key to trigger stagger animation on data change
  let animationKey = $state(0);
  let lastFilteredLength = $state(0);
  let lastFilter = $state('all');
  
  // Only increment key when filter changes or notification count changes
  $effect(() => {
    if (selectedFilter !== lastFilter || filteredNotifications.length !== lastFilteredLength) {
      animationKey++;
      lastFilter = selectedFilter;
      lastFilteredLength = filteredNotifications.length;
    }
  });
</script>

<svelte:window onclick={handleClickOutside} />

<div class="notification-container">
  <!-- Header Section -->
  <div class="notification-header">
    <div class="header-content">
      <h1 class="page-title">Notifications</h1>
      <p class="page-subtitle">
        Stay updated with your academic activities
        <span class="notification-badge">{unreadCount} unread</span>
      </p>
    </div>
  </div>

  <!-- Filter and Actions Section -->
  <div class="filter-actions-section">
    <div class="filter-section">
      <div class="filter-dropdown">
        <button class="filter-toggle" onclick={toggleFilterDropdown}>
          <div class="filter-toggle-content">
            <span class="material-symbols-outlined filter-icon">{getFilterIcon(selectedFilter)}</span>
            <span class="filter-label">{getFilterLabel(selectedFilter)}</span>
          </div>
          <span class="material-symbols-outlined dropdown-arrow" class:rotated={isFilterDropdownOpen}>expand_more</span>
        </button>
        
        {#if isFilterDropdownOpen}
          <div class="filter-dropdown-menu">
            {#each filterOptions as option}
              <button 
                class="filter-dropdown-item" 
                class:active={option.value === selectedFilter}
                onclick={() => selectFilter(option.value)}
              >
                <span class="material-symbols-outlined">{option.icon}</span>
                <span>{option.label}</span>
                {#if option.value === 'unread'}
                  <span class="count-badge">{unreadCount}</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="actions-section">
      {#if unreadCount > 0}
        <button class="notifications-action-btn mark-all-read" onclick={markAllAsRead} title="Mark All Read">
          <span class="material-symbols-outlined">done_all</span>
        </button>
      {/if}
      
      {#if notifications.some(n => n.isRead)}
        <button class="notifications-action-btn clear-read" onclick={clearAllRead} title="Clear Read">
          <span class="material-symbols-outlined">clear_all</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Notifications List -->
  <div class="notifications-section">
    {#if loading}
      <div class="loading-state">
        <div class="system-loader"></div>
        <p>Loading notifications...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="error-icon">
          <span class="material-symbols-outlined">error</span>
        </div>
        <h3>Error Loading Notifications</h3>
        <p>{error}</p>
        <button class="retry-btn" onclick={fetchNotifications}>
          Reload
        </button>
      </div>
    {:else if filteredNotifications.length > 0}
      {#key animationKey}
        <div class="notifications-list">
          {#each filteredNotifications as notification, index (notification.id)}
            {#if notification.type === 'document' || notification.type === 'document_request'}
              <div 
                class="notification-card {notification.isRead ? 'read' : 'unread'} clickable"
                style="--card-index: {index};"
                onclick={() => handleNotificationClick(notification)}
                onkeydown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
                role="button"
                tabindex="0"
              >
                <!-- Notification Header -->
                <div class="notification-header-card">
                  <h3 class="notification-title">
                    {notification.title}
                  </h3>
                  <span class="notification-time">{formatTimestamp(notification.timestamp)}</span>
                </div>
                
                <!-- Notification Details -->
                <div class="notification-details">
                  <div class="notification-content">
                    <p class="notification-message">{notification.message}</p>
                    
                    <!-- Document Request Specific Info -->
                    {#if notification.adminNote}
                      <div class="admin-note">
                        <span class="material-symbols-outlined">note</span>
                        <div class="note-content">
                          <span class="note-label">Admin Note:</span>
                          <span class="note-text">{notification.adminNote}</span>
                        </div>
                      </div>
                    {/if}
                    {#if notification.rejectionReason}
                      <div class="rejection-reason">
                        <span class="material-symbols-outlined">error</span>
                        <div class="reason-content">
                          <span class="reason-label">Rejection Reason:</span>
                          <span class="reason-text">{notification.rejectionReason}</span>
                        </div>
                      </div>
                    {/if}
                  </div>
                  
                  <!-- Notification Actions -->
                  <div class="notification-actions">
                    <button 
                      class="action-btn-small read-toggle"
                      onclick={(e) => { e.stopPropagation(); toggleNotificationRead(notification.id); }}
                      title={notification.isRead ? 'Mark as unread' : 'Mark as read'}
                    >
                      <span class="material-symbols-outlined">
                        {notification.isRead ? 'mark_email_unread' : 'mark_email_read'}
                      </span>
                    </button>
                    
                    <button 
                      class="action-btn-small delete-btn"
                      onclick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                      title="Delete notification"
                    >
                      <span class="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            {:else}
              <div 
                class="notification-card {notification.isRead ? 'read' : 'unread'}"
                style="--card-index: {index};"
              >
                <!-- Notification Header -->
                <div class="notification-header-card">
                  <h3 class="notification-title">
                    {notification.title}
                  </h3>
                  <span class="notification-time">{formatTimestamp(notification.timestamp)}</span>
                </div>
                
                <!-- Notification Details -->
                <div class="notification-details">
                  <div class="notification-content">
                    <p class="notification-message">{notification.message}</p>
                  </div>
                  
                  <!-- Notification Actions -->
                  <div class="notification-actions">
                    <button 
                      class="action-btn-small read-toggle"
                      onclick={(e) => { e.stopPropagation(); toggleNotificationRead(notification.id); }}
                      title={notification.isRead ? 'Mark as unread' : 'Mark as read'}
                    >
                      <span class="material-symbols-outlined">
                        {notification.isRead ? 'mark_email_unread' : 'mark_email_read'}
                      </span>
                    </button>
                    
                    <button 
                      class="action-btn-small delete-btn"
                      onclick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                      title="Delete notification"
                    >
                      <span class="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/key}
    {:else}
      <div class="no-notifications">
        <div class="no-notifications-icon">
          <span class="material-symbols-outlined">
            {selectedFilter === 'unread' ? 'mark_email_read' : 'notifications_off'}
          </span>
        </div>
        <h3>
          {selectedFilter === 'unread' ? 'All Caught Up!' : 'No Notifications'}
        </h3>
        <p>
          {selectedFilter === 'unread' 
            ? 'You have no unread notifications. Great job staying on top of things!' 
            : selectedFilter === 'all'
            ? 'You don\'t have any notifications yet.'
            : `No ${getFilterLabel(selectedFilter).toLowerCase()} notifications found.`
          }
        </p>
      </div>
    {/if}
  </div>
</div>