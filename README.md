# High School Student Information System (SET-2)

A comprehensive student information system built with SvelteKit, designed specifically for Philippine high school students (Grades 7-10) following the DepEd curriculum.

## 🆕 Recent Updates & Features

### ✅ Completed Features

#### 🔐 Authentication & Security
- **Complete Authentication System** with role-based access control (Student, Teacher, Admin)
- **Secure Password Management** with bcrypt hashing (12 salt rounds)
- **Forgot Password System** with 6-digit verification codes and 15-minute expiration
- **Change Password Feature** with current password verification
- **Account Number-Based Login** supporting both account numbers and email addresses
- **Activity Logging System** with MongoDB storage and IP tracking
- **Session Management** with heartbeat monitoring and automatic logout

#### 📧 Email System
- **Brevo API Integration** for reliable email delivery
- **Account Creation Emails** with beautifully designed Material Design 3 templates
- **Password Reset Emails** with secure verification codes
- **HTML and Plain Text** email support for all email clients

#### 👨‍🎓 Student Portal
- **Profile Management** with personal information display
- **Advanced Grade Viewing** with AI-powered performance analysis using OpenRouter API
- **Interactive Grade Charts** (Subject Performance, Assessment Type breakdown)
- **Class Rankings System** with live position tracking and section-wide comparisons
- **Class Schedule** with daily and weekly views
- **Document Requests** with status tracking and submission history
- **Smart Notifications** with filtering by type (grades, schedule, documents, todo)
- **Todo List Management** with categories, due dates, completion tracking, and priority levels

#### 👨‍🏫 Teacher Portal
- **Personal Profile** with teaching information
- **Class Schedule** with teaching assignments and time management
- **Class Management** with advanced features including:
  - **Class Selection** interface for choosing teaching assignments
  - **Grading Spreadsheet** with real-time calculations
  - **Grade Item Management** with customizable scoring
  - **Grade Verification System** with digital signatures
  - **Student Performance Tracking** with detailed analytics
- **Advisory Class Management** with comprehensive student oversight and mentoring tools
- **Section Assignment** with student roster management

#### 👨‍💼 Admin Portal
- **Dashboard** with system statistics, animated counters, and interactive charts
  - Students per Grade Level Chart
  - Sections per Grade Level Chart
  - Document Request Status Chart
- **Account Creation** for all user types with email notifications
- **Student Masterlist** with full CRUD operations and search capabilities
- **Archived Students** management with restoration capabilities
- **Student Grades List** for academic oversight across all students
- **Department Management** with organizational structure
- **Schedule Management** with:
  - Room Management and facility organization
  - Section Management and class organization
  - Time Slot Management with conflict detection
- **Subjects and Activities** management aligned with DepEd curriculum
- **Document Request Management** with approval workflows and status tracking
- **Admin Settings** for system configuration (current school year, quarters, etc.)
- **Bulk Student Operations** with Excel file import/export

### 🎯 Key Implementations
- **Svelte 5 Runes**: Modern reactive state management using `$state()` and `$derived()`
- **Component-Scoped Styling**: Each component has unique CSS prefixes to prevent conflicts
- **Material Design 3**: Custom components built with MD3 design tokens and principles
- **Philippine DepEd Curriculum**: Subject management aligned with local educational standards
- **MongoDB Database**: NoSQL database with flexible document structure and efficient queries
- **RESTful API Architecture**: 35+ well-structured API endpoints with proper error handling
- **Advanced Authentication**: Secure password hashing with bcrypt and role-based access control
- **Activity Tracking**: Comprehensive logging system with MongoDB document storage
- **Responsive Design**: Mobile-first approach with collapsible navigation systems
- **AI Integration**: OpenRouter API integration for intelligent grade analysis with caching
- **Data Visualization**: Chart.js integration for interactive charts and statistics
- **Animated UI**: CountUp.js for smooth number animations in dashboards and statistics

## 🏗️ Project Architecture

### File Structure Overview

```
src/
├── app.html                    # Main HTML template
├── components/                 # Reusable UI components
│   ├── common/                # Shared components across all user types
│   │   ├── Modal.svelte       # Reusable modal dialog component
│   │   ├── ModalContainer.svelte # Global modal manager
│   │   ├── CountUp.svelte     # Animated number counter using CountUp.js
│   │   ├── Toast.svelte       # Notification component
│   │   ├── ToastContainer.svelte # Global toast manager
│   │   └── js/                # Shared JavaScript utilities
│   │       ├── modalStore.js  # Modal state management
│   │       └── toastStore.js  # Toast notification store
│   ├── login/                 # Authentication components
│   │   ├── loginpage.svelte   # Main login interface
│   │   ├── loginpage.css      # Login-specific styles
│   │   └── js/                # Authentication logic
│   │       ├── auth.js        # Authentication store
│   │       ├── authHelpers.js # Authentication utilities
│   │       ├── theme.js       # Theme management
│   │       └── validation.js  # Form validation
│   └── users/                 # Role-based components
│       ├── admin/             # Administrator interface
│       │   ├── navigations/   # Admin navigation components
│       │   │   ├── adminMenu/
│       │   │   └── adminNavbar/
│       │   └── sections/      # Admin feature modules
│       │       ├── adminDashboard/
│       │       │   └── adminDashboardCharts/
│       │       ├── adminAccountCreation/
│       │       ├── adminStudentMasterlist/
│       │       ├── adminArchivedStudents/
│       │       ├── adminStudentGradesList/
│       │       ├── adminDepartmentManagement/
│       │       ├── adminScheduleManagement/
│       │       │   ├── adminRoomForm/
│       │       │   ├── adminSectionForm/
│       │       │   └── adminScheduleForm/
│       │       ├── adminSubjectsAndActivities/
│       │       ├── adminDocumentRequests/
│       │       │   └── adminDocumentRequestModal/
│       │       └── adminSettings/
│       ├── student/           # Student interface
│       │   ├── navigations/   # Student navigation components
│       │   │   ├── studentMenu/
│       │   │   └── studentNavbar/
│       │   ├── sections/      # Student feature modules
│       │   │   ├── studentProfile/
│       │   │   ├── studentGrade/
│       │   │   │   └── studentGradeCharts/
│       │   │   ├── studentClassRanking/
│       │   │   ├── studentSchedule/
│       │   │   ├── studentDocumentRequest/
│       │   │   │   └── studentDocumentRequestModal/
│       │   │   ├── studentNotification/
│       │   │   └── studentTodolist/
│       │   └── stores/        # Student-specific state stores
│       └── teacher/           # Teacher interface
│           ├── navigations/   # Teacher navigation components
│           └── sections/      # Teacher feature modules
│               ├── teacherProfile/
│               ├── teacherSchedule/
│               ├── teacherClassManagement/
│               │   ├── teacherClassSelection/
│               │   └── teacherClassList/
│               │       └── GradingSpreadsheet.svelte
│               └── teacherAdvisoryClass/
├── lib/                       # Shared libraries and assets
│   ├── assets/               # Static assets (images, icons)
│   │   ├── favicon.svg       # Default site favicon
│   │   ├── favicon-student.svg
│   │   ├── favicon-teacher.svg
│   │   ├── favicon-admin.svg
│   │   └── images/           # Login background images (light/dark themes)
│   ├── stores/               # Global state management stores
│   │   ├── admin/            # Admin-specific stores
│   │   │   ├── dashboardStore.js
│   │   │   ├── roomManagementStore.js
│   │   │   └── sectionManagementStore.js
│   │   ├── student/          # Student-specific stores
│   │   │   ├── studentClassRankingStore.js
│   │   │   ├── studentDocumentRequestStore.js
│   │   │   ├── studentGradeStore.js
│   │   │   ├── studentProfileStore.js
│   │   │   ├── studentScheduleStore.js
│   │   │   └── studentTodolistStore.js
│   │   └── teacher/          # Teacher-specific stores
│   │       ├── teacherProfileStore.js
│   │       └── teacherScheduleStore.js
│   └── styles/               # Global styling system
│       ├── design-system.css # Main design system entry point
│       ├── +page.css         # Page-specific styles
│       └── design-system-styles/ # Modular CSS architecture
│           ├── variables.css # CSS custom properties
│           ├── themes.css    # Light/dark mode configurations
│           ├── base.css      # Base styles and resets
│           ├── utilities.css # Utility classes
│           └── layout.css    # Layout-specific styles
└── routes/                   # SvelteKit routing
    ├── +layout.svelte       # Global layout wrapper
    ├── +page.svelte         # Main application entry point
    ├── database/            # Database connection
    │   └── db.js           # MongoDB connection handler
    └── api/                 # Backend API endpoints (35+ endpoints)
        ├── auth/            # Authentication & session management
        ├── accounts/        # Account creation & management
        ├── activity-logs/   # User activity tracking
        ├── activity-types/  # Activity type definitions
        ├── admin-settings/  # System configuration
        ├── ai-grade-analysis/ # AI-powered grade insights
        ├── archived-students/ # Student archiving operations
        ├── change-password/ # Password change functionality
        ├── class-rankings/  # Student class ranking calculations
        ├── class-students/  # Class roster management
        ├── current-quarter/ # Academic quarter tracking
        ├── dashboard/       # Dashboard statistics
        ├── departments/     # Department management
        ├── document-requests/ # Document request handling
        ├── forgot-password/ # Password reset flow
        ├── grades/          # Grade management & calculations
        ├── notifications/   # User notifications
        ├── rooms/           # Room/facility management
        ├── schedules/       # Schedule management
        ├── sections/        # Section management
        ├── student-grades/  # Student grade queries
        ├── student-profile/ # Student profile data
        ├── student-todos/   # Todo list management
        ├── students-bulk/   # Bulk student operations
        ├── subjects/        # Subject management
        ├── teacher-advisory/# Advisory class management
        ├── teacher-profile/ # Teacher profile data
        ├── teacher-sections/# Teacher section assignments
        ├── users/           # User management
        └── helper/          # API utility functions
            ├── api-helper.js      # Authenticated fetch wrapper
            ├── auth-helper.js     # Authentication utilities
            ├── email-helper.js    # Brevo email integration
            ├── encryption-helper.js # Data encryption
            └── notification-helper.js # Notification creation
```

## 🎨 Design System Architecture

### Modular CSS Structure

The project uses a sophisticated modular CSS architecture located in `src/lib/styles/design-system-styles/`:

1. **variables.css** - CSS custom properties for colors, typography, spacing
2. **themes.css** - Light/dark mode configurations
3. **base.css** - Base styles and CSS resets
4. **utilities.css** - Utility classes and helper styles
5. **layout.css** - Layout-specific styles and containers

### Design Tokens

#### Color System
- **School Brand Colors**: Primary (#1565c0), Secondary (#03a9f4), Accent (#00acc1)
- **Academic Status Colors**: Success (#3a9c3f), Warning (#f57c00), Error (#d32f2f), Info (#1976d2)
- **Grade Performance Colors**: 
  - Excellent (#2e7d32), Good (#f57f17), Satisfactory (#ff9800)
  - Needs Improvement (#d32f2f), No Grade (#9e9e9e)
- **Request Status Colors**: Pending (#fff8e1 bg, #ffc107 border, #ff6f00 text)
- **Material Design 3 Tokens**: Complete md-sys-color-* system for consistent theming

#### Typography System
- **Font Family**: Roboto (imported from Google Fonts)
- **Typography Scale**: Material Design 3 typescale system
  - Display Large (57px), Headline Large (32px), Title Large (22px)
  - Body Large (16px), Label Large (14px)
- **Font Weights**: 400 (regular), 500 (medium), 700 (bold)

#### Icon System
- **Material Symbols**: Outlined style with variable font support
- **Customization**: opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200
- **Usage**: Consistent iconography across all components

### Styling Patterns

- **Component-Scoped Styles**: Each component has its own CSS file
- **Prefix-Based Naming**: Unique class prefixes prevent style conflicts
- **CSS Custom Properties**: Extensive use of CSS variables for theming
- **Material Design Styling**: Custom components built with Material Design 3 principles and design tokens

## 🏛️ Component Architecture

### Role-Based Organization

Components are organized by user roles with consistent patterns:

```
components/
├── common/                   # Shared components across all user types
│   ├── Modal.svelte         # Modal dialog component
│   ├── ModalContainer.svelte # Global modal manager
│   ├── Odometer.svelte      # Animated number counter
│   ├── Toast.svelte         # Notification component
│   ├── ToastContainer.svelte # Global toast manager
│   └── js/                  # Shared JavaScript utilities
│       ├── modalStore.js    # Modal state management
│       └── toastStore.js    # Toast notification store
├── login/                   # Authentication components
│   ├── loginpage.svelte     # Main login interface
│   ├── loginpage.css        # Login-specific styles
│   └── js/                  # Authentication logic
│       ├── auth.js          # Authentication store
│       ├── authHelpers.js   # Authentication utilities
│       ├── theme.js         # Theme management
│       └── validation.js    # Form validation
└── users/                   # Role-based components
    ├── [role]/
    │   ├── navigations/     # Navigation components
    │   │   ├── [role]Menu/ # Side navigation menu
    │   │   └── [role]Navbar/ # Top navigation bar
    │   └── sections/       # Feature-specific components
    │       ├── [feature1]/ # Individual feature modules
    │       ├── [feature2]/
    │       └── [feature3]/
```

### Component Structure Pattern

Each component follows a consistent structure:
- **Component.svelte** - Main component logic and template
- **component.css** - Component-specific styles
- **Unique prefixes** - CSS classes use component-specific prefixes

### Global Component Systems

#### Modal System
- **Modal.svelte** - Reusable modal dialog component
- **ModalContainer.svelte** - Global modal manager for the entire application
- **modalStore.js** - Centralized state management for modal operations
- **Features**: Backdrop click to close, ESC key support, focus management

#### Toast Notification System
- **Toast.svelte** - Individual toast notification component
- **ToastContainer.svelte** - Global toast manager with positioning
- **toastStore.js** - Toast state management with auto-dismiss functionality
- **Features**: Multiple toast types (success, error, warning, info), auto-dismiss timers

#### Animation Components
- **CountUp.svelte** - Animated number counter using CountUp.js library for statistics and metrics
- **Features**: Customizable duration, easing, decimal places, color transitions based on grade thresholds
- **Integration**: Used in dashboards, grade displays, and data visualization components

### User Roles & Features

#### 👨‍💼 Admin Features
- **Dashboard** with system overview and statistics using animated CountUp counters and Chart.js visualizations
- **Account Creation** for students, teachers, and administrators with automatic email notifications
- **Student Masterlist** with comprehensive CRUD operations, search, and filter capabilities
- **Archived Students** management with restoration capabilities and status tracking
- **Student Grades List** for academic oversight and performance monitoring across all students
- **Department Management** for organizational structure and teacher assignments
- **Schedule Management** system with:
  - Room/facility management with CRUD operations
  - Section management by grade level
  - Time slot management with conflict detection
- **Subjects and Activities** management (DepEd curriculum-aligned) with grade level assignments
- **Document Request Management** with approval workflows, status tracking, and Chart.js analytics
- **Admin Settings** for system configuration (school year, quarters, grading periods)
- **Bulk Operations** for efficient student data import/export using Excel files

#### 👨‍🎓 Student Features
- **Profile Management** with personal information display and profile picture
- **Grade Viewing** with:
  - AI-powered performance analysis using OpenRouter API (cached for 7 days)
  - Interactive Chart.js visualizations (Subject Performance, Assessment Types)
  - Detailed breakdown by Written Work, Performance Tasks, and Quarterly Assessments
  - Real-time grade calculations with weighted averages
- **Class Rankings** with live position tracking, section-wide comparisons, and performance metrics
- **Class Schedule** with daily and weekly views, color-coded subjects
- **Document Requests** with status tracking, submission history, and modal interface
- **Smart Notifications** with filtering by type (grades, schedule, documents, todo)
- **Todo List Management** with categories, due dates, completion tracking, and priority levels

#### 👨‍🏫 Teacher Features
- **Personal Profile** with teaching information and class assignments
- **Class Schedule** with teaching assignments, time management, and room information
- **Class Management** with advanced grading features:
  - **Class Selection** interface for choosing teaching assignments
  - **Grading Spreadsheet** with Excel-like interface and real-time calculations
  - **Grade Item Management** with customizable scoring and total score configuration
  - **Grade Verification System** for finalizing student grades with digital tracking
  - **Bulk Grade Entry** for efficient data input across multiple students
- **Advisory Class Management** with:
  - Comprehensive student oversight and academic monitoring
  - Class-wide performance analytics
  - Student intervention tracking
- **Student Performance Tracking** with detailed academic progress monitoring and analytics

## 🔄 Application Flow & Rendering

### Single Page Application (SPA) Architecture

1. **Entry Point**: `+page.svelte` serves as the main application controller
2. **Authentication**: Auth state determines which interface to render
3. **Role-Based Rendering**: Components are conditionally rendered based on user role
4. **State Management**: Reactive state management using Svelte 5's `$state()` runes

### Navigation System

- **Collapsible Navigation Rails**: Each role has expandable/collapsible side navigation
- **Section-Based Routing**: Internal navigation switches between feature sections
- **Consistent Navigation Pattern**: All roles follow the same navigation structure

### State Management Pattern

```javascript
// Reactive state for each user role
let activeSection = $state('grades');           // Student
let teacherActiveSection = $state('schedule');  // Teacher  
let adminActiveSection = $state('dashboard');   // Admin

// Navigation visibility states
let isNavRailVisible = $state(false);          // Student nav
let teacherNavRailVisible = $state(false);     // Teacher nav
let adminNavRailVisible = $state(false);       // Admin nav
```

## 🛠️ Technology Stack

### Core Framework
- **Framework**: SvelteKit 2.22.0 with Svelte 5.0.0
- **Build Tool**: Vite 7.0.4
- **Package Manager**: npm
- **Node.js**: Version 22 (specified in package.json engines)
- **Adapter**: @sveltejs/adapter-node 5.3.1 for production deployment

### Backend & Database
- **Database**: MongoDB 6.20.0 (NoSQL document database)
- **Database Driver**: mongodb (official MongoDB Node.js driver)
- **Authentication**: bcrypt 6.0.0 for secure password hashing (12 salt rounds)
- **Environment Management**: dotenv 17.2.2 for configuration management
- **File Processing**: xlsx 0.18.5 for Excel spreadsheet operations (import/export)
- **Email Service**: Brevo API for transactional emails

### Development Tools
- **ESLint**: 9.18.0 with Svelte plugin for code linting
- **Prettier**: 3.4.2 with Svelte plugin for code formatting
- **TypeScript Support**: JSConfig for enhanced development experience and path aliases
- **Globals**: 16.0.0 for ESLint global configuration

### UI & Styling
- **Styling**: Modular CSS with Material Design 3 principles
- **Design System**: Custom CSS architecture with design tokens and CSS variables
- **Icons**: Material Symbols Outlined font (variable font with 600+ icons)
- **Typography**: Roboto font family (300, 400, 500, 600, 700 weights)
- **Charts**: Chart.js 4.5.1 for interactive data visualizations
- **Animations**: CountUp.js 2.9.0 for smooth number animations with easing

### AI & External APIs
- **AI Analysis**: OpenRouter API integration for grade analysis
- **AI Model**: Configurable via environment variables
- **Email Delivery**: Brevo (formerly Sendinblue) API for reliable email sending
- **HTTP Client**: node-fetch 3.3.2 for server-side API calls

### Architecture
- **Component System**: Role-based component organization with modular architecture
- **State Management**: Svelte 5 runes (`$state()`, `$derived()`) for reactive programming
- **Routing**: SvelteKit file-based routing with API route handlers
- **Authentication**: Custom auth store with role-based access control and secure session management
- **Database Architecture**: MongoDB with flexible document structure, indexing, and aggregation pipelines
- **API Design**: RESTful endpoints (35+) with proper error handling, validation, and response codes
- **Caching Strategy**: MongoDB-based caching for AI analysis results (7-day TTL)
- **Security**: Request sanitization, rate limiting considerations, bcrypt password hashing


#### Authentication Features

- **Account Number-Based Login**: System supports account numbers for secure authentication
- **Secure Password Hashing**: Uses bcrypt with 12 salt rounds for robust password security
- **Automatic Role Detection**: System determines user role based on account_type field in MongoDB
- **Role-based Routing**: Each account type (student, teacher, admin) redirects to its respective portal
- **Personalized Interface**: Login success includes user's full name, gender, and role-specific navigation
- **Session Management**: Client-side session handling with activity tracking and logout functionality
- **Heartbeat System**: Periodic session validation to maintain active user connections
- **Activity Logging**: All authentication events logged with IP address, user agent, and timestamp
- **Form Validation**: Client-side validation for login credentials with comprehensive error handling
- **Password Recovery**: Forgot password system with email verification codes (15-minute expiration)
- **Password Change**: Secure password change with current password verification (minimum 8 characters)
- **Database Integration**: Authentication queries against MongoDB with indexed lookups for performance
- **Security Measures**: Input sanitization, SQL injection prevention, status-based account access control

## 🗄️ Database Architecture

### MongoDB Collections

The system uses MongoDB with the following primary collections:

- **users**: Student, teacher, and admin accounts with authentication credentials
- **sections**: Class sections organized by grade level
- **section_students**: Student enrollment records linking users to sections
- **subjects**: Course subjects aligned with DepEd curriculum
- **schedules**: Class schedules with time slots, rooms, and teacher assignments
- **grades**: Student grades with written work, performance tasks, and quarterly assessments
- **grade_configurations**: Grading criteria and item configurations per section/subject
- **rooms**: Classroom and facility information
- **departments**: Academic department organization
- **document_requests**: Student document request submissions and approvals
- **notifications**: User notifications with read/unread status
- **student_todos**: Student todo items with categories and due dates
- **activity_logs**: System-wide activity tracking with IP and user agent
- **activity_types**: Predefined activity type definitions
- **admin_settings**: System configuration (school year, quarters, etc.)
- **ai_grade_analysis_cache**: Cached AI analysis results (7-day TTL)
- **password_reset_tokens**: Temporary password reset verification codes

### Key MongoDB Features Used
- **Aggregation Pipelines**: Complex queries with $lookup, $group, $match for analytics
- **Indexing**: Optimized queries with indexes on frequently accessed fields
- **Document References**: ObjectId references for relational data between collections
- **Flexible Schema**: Dynamic document structure for evolving requirements
- **Embedded Documents**: Nested data structures for grade items and configurations

## 🎯 Educational Context

### Philippine DepEd Curriculum Integration

- **Target Grades**: 7-10 (Junior High School)
- **Subject Management**: Aligned with DepEd K-12 curriculum standards
- **Academic Calendar**: Follows Philippine school year structure (June-March)
- **Grading System**: DepEd grading weights (Written Work: 30%, Performance Tasks: 50%, Quarterly Assessment: 20%)
- **Document Types**: Standard DepEd forms and requirements (Form 137, Good Moral, etc.)
- **Grade Scale**: 90-100 (Outstanding), 85-89 (Very Satisfactory), 80-84 (Satisfactory), 75-79 (Fairly Satisfactory), Below 75 (Did Not Meet Expectations)

## 🚀 Development Workflow

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=set-2-system

# Email Configuration (Brevo API)
BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=noreply@yourdomain.com

# AI Configuration (OpenRouter)
OPENROUTER_AI_KEY=your_openrouter_api_key
AI_MODEL=openai/gpt-4-turbo-preview

# Optional: Server Configuration
PORT=3000
```

### Getting Started

```sh
# Install dependencies
npm install

# Start development server (default port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Start production server (requires build first)
npm run start

# Lint code
npm run lint

# Format code
npm run format
```

### Development Guidelines

1. **Component Creation**: Follow role-based organization pattern in `src/components/users/[role]/sections/`
2. **Styling**: Use design system variables from `variables.css` and maintain unique CSS class prefixes per component
3. **Navigation**: Update corresponding menu components when adding new sections
4. **Consistency**: Reference existing components for design patterns and naming conventions
5. **Custom Dropdowns**: Use custom dropdown implementations (reference schedule management)
6. **State Management**: Use Svelte 5 runes (`$state()`, `$derived()`) for reactive state
7. **API Integration**: Use `api-helper.js` for authenticated API calls
8. **Error Handling**: Always implement proper try-catch blocks and user-friendly error messages

## 📁 Key Files & Their Purposes

### Core Application Files
- **`+layout.svelte`**: Global layout wrapper, imports design system, manages fonts and meta tags, includes global toast and modal containers
- **`+page.svelte`**: Main application controller (SPA entry point), handles authentication and role-based conditional rendering using Svelte 5 runes
- **`app.html`**: Root HTML template with meta tags, Material Symbols, and Roboto font imports

### Styling System
- **`design-system.css`**: Central import point for all design system modules
- **`design-system-styles/`**: Modular CSS architecture
  - `variables.css`: CSS custom properties (colors, typography, spacing, MD3 tokens)
  - `themes.css`: Light/dark mode configurations with theme-specific color schemes
  - `base.css`: CSS resets, base element styles, and normalization
  - `utilities.css`: Utility classes for common styling patterns
  - `layout.css`: Layout-specific styles and container systems

### Database & API
- **`db.js`**: MongoDB connection handler using MongoClient with connection pooling
- **`api/`**: 35+ RESTful API endpoints organized by feature domain
  - Authentication endpoints with bcrypt password verification
  - Account management with email notifications
  - Grade management with aggregation pipelines
  - Document request workflows
  - Activity logging with MongoDB document storage
  - AI-powered analysis endpoints

### State Management
- **`auth.js`**: Authentication store with role detection and session handling using Svelte stores
- **`modalStore.js`**: Global modal state management with show/hide functionality
- **`toastStore.js`**: Toast notification system with auto-dismiss timers
- **Role-specific stores**: Separate stores for admin, student, and teacher features (dashboard, grades, profile, etc.)

### Helper Utilities
- **`api-helper.js`**: Authenticated fetch wrapper with automatic header injection
- **`auth-helper.js`**: Authentication utilities and user context extraction
- **`email-helper.js`**: Brevo API integration for transactional emails with HTML/text templates
- **`encryption-helper.js`**: Data encryption utilities for sensitive information
- **`notification-helper.js`**: Notification creation and management helpers

### Component Architecture
- **Navigation Components**: Role-specific menu and navbar components for admin, student, and teacher
- **Section Components**: Feature modules organized by user role (30+ section components)
- **Modal Systems**: Reusable modal dialogs with global state management
- **Chart Components**: Chart.js integration for data visualizations (7+ chart types)
- **Form Components**: Time inputs, dropdowns, and custom form controls
- **Grading Components**: Advanced spreadsheet-style grading interface with Excel-like functionality

## 🔧 Customization & Extension

### Adding New Features

1. **Create Component Structure**
   - Create directory in `src/components/users/[role]/sections/[featureName]/`
   - Add main Svelte component: `[featureName].svelte`
   - Add component-scoped CSS: `[featureName].css`
   - Create subdirectories for modals, charts, or sub-components as needed

2. **Update Navigation**
   - Add navigation item to `src/components/users/[role]/navigations/[role]Menu/`
   - Add section state variable in `+page.svelte`
   - Add conditional rendering block in `+page.svelte`

3. **API Integration (if needed)**
   - Create new API endpoint in `src/routes/api/[endpoint]/+server.js`
   - Implement GET, POST, PUT, DELETE handlers as needed
   - Use MongoDB aggregation pipelines for complex queries
   - Add proper error handling and validation

4. **State Management (if needed)**
   - Create store in `src/lib/stores/[role]/[feature]Store.js`
   - Use Svelte writable stores for global state
   - Import and use in components with `get()` or store subscription

5. **Testing & Documentation**
   - Test across different screen sizes
   - Verify role-based access controls
   - Update README if adding major features
   - Check browser console for errors

### Styling Guidelines

- **Design System Variables**: Use CSS custom properties from `variables.css`
  ```css
  color: var(--md-sys-color-primary);
  font-family: var(--md-sys-typescale-body-large-font-family-name);
  ```
- **Component Prefixes**: Use unique class prefixes per component (e.g., `studentgrade-`, `adminroom-`)
- **Material Design 3**: Follow MD3 principles for elevation, color, typography
- **Responsive Design**: Use mobile-first approach with appropriate breakpoints
- **Dark Mode**: Consider theme variables for light/dark mode compatibility
- **Accessibility**: Ensure proper contrast ratios and ARIA labels

### MongoDB Best Practices

- **Indexing**: Create indexes on frequently queried fields (account_number, email, status)
- **Aggregation**: Use pipelines for complex queries instead of multiple queries
- **ObjectId**: Use `new ObjectId(id)` for MongoDB document references
- **Validation**: Always validate and sanitize user input before database operations
- **Error Handling**: Implement try-catch blocks for all database operations
- **Connection Pooling**: Reuse database connections instead of creating new ones

### Security Best Practices

- **Authentication**: Always verify user authentication before sensitive operations
- **Authorization**: Check user roles and permissions for feature access
- **Input Sanitization**: Validate and sanitize all user inputs (regex, length checks)
- **Password Security**: Use bcrypt with 12+ salt rounds for password hashing
- **Environment Variables**: Never commit sensitive credentials (use .env files)
- **Rate Limiting**: Consider implementing rate limiting for API endpoints
- **HTTPS**: Always use HTTPS in production environments

### Development Best Practices

- **State Management**: Use Svelte 5 runes (`$state()`, `$derived()`) for local reactive state
- **Component Organization**: Follow role-based directory structure strictly
- **Global Systems**: Utilize toast notifications and modal dialogs for user feedback
- **Code Reusability**: Extract common functionality into helper utilities
- **Error Messages**: Provide clear, user-friendly error messages
- **Comments**: Add comments for complex logic or business rules
- **Formatting**: Use Prettier for consistent code formatting
- **Linting**: Run ESLint to catch potential issues before deployment

## 🚢 Deployment

### Production Deployment

1. **Build the application**
   ```sh
   npm run build
   ```

2. **Configure environment variables** on your hosting platform (Render, Vercel, etc.)

3. **Start the production server**
   ```sh
   npm run start
   ```

4. **MongoDB Setup**: Ensure MongoDB instance is accessible from production server

5. **Email Service**: Configure Brevo API credentials for email functionality

6. **AI Service**: Set up OpenRouter API key for grade analysis features

### Hosting Platforms

The application is configured for deployment on:
- **Node.js servers**: Using @sveltejs/adapter-node
- **Render**: Configured with ngrok support in vite.config.js
- **Any VPS**: With Node.js 22+ and MongoDB access

---

## 📊 Project Statistics

- **Total Components**: 50+ Svelte components
- **API Endpoints**: 35+ RESTful endpoints
- **Lines of Code**: 20,000+ lines
- **Supported User Roles**: 3 (Student, Teacher, Admin)
- **Database Collections**: 15+ MongoDB collections
- **Features**: 30+ distinct features across all user roles

---

This system provides a **scalable, maintainable, and feature-rich** foundation for managing high school student information with a focus on the **Philippine educational context** and **modern web development practices** using cutting-edge technologies like Svelte 5, MongoDB, and AI-powered analytics.
