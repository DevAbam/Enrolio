# AGENT.md — SchoolOps Pro MVP Build Instructions

> This file is the single source of truth for Claude Code to build the SchoolOps Pro MVP.
> Read this entire file before writing a single line of code.
> Follow every instruction exactly. Ask for clarification before deviating.

---

## 0. WHAT YOU ARE BUILDING

A **multi-tenant SaaS platform** for schools to manage:

- Student & teacher registration
- Class management with term fees
- Fee payment recording & outstanding balance tracking
- Revenue dashboard
- Student & teacher daily attendance
- Manual SMS fee reminders (single, selected, bulk)

**Tech stack:**
- Backend: Supabase (PostgreSQL + Auth + RLS)
- Frontend: Next.js 14 (App Router) + TailwindCSS + Supabase JS v2
- SMS: External provider via server-side API route
- Deployment: Vercel + Supabase hosted project

---

## 1. DESIGN SYSTEM & COLOR SCHEME

> This is non-negotiable. Every component, page, and element must follow this design system exactly. Do not use arbitrary colors outside of this palette.

### 1.1 Color Palette

```
Primary Green:   #16a34a  (green-600)   — buttons, active states, accents
Green Light:     #22c55e  (green-500)   — hover states, highlights
Green Dark:      #15803d  (green-700)   — pressed states, deep accents
Green Pale:      #dcfce7  (green-100)   — backgrounds, badges, tints
Green Subtle:    #f0fdf4  (green-50)    — page backgrounds, cards in light mode

Light Mode:
  Background:    #ffffff  (white)
  Surface:       #f0fdf4  (green-50)    — sidebar, cards
  Border:        #bbf7d0  (green-200)
  Text Primary:  #14532d  (green-900)
  Text Secondary:#166534  (green-800)
  Text Muted:    #6b7280  (gray-500)

Dark Mode:
  Background:    #0a0f0a  (near black with green tint)
  Surface:       #111b11  (very dark green-tinted)
  Card:          #1a2e1a  (dark green-tinted card)
  Border:        #166534  (green-800)
  Text Primary:  #f0fdf4  (green-50)
  Text Secondary:#bbf7d0  (green-200)
  Text Muted:    #6b7280  (gray-500)
  Accent:        #16a34a  (green-600)
```

### 1.2 Tailwind Config

Create `tailwind.config.ts` exactly as follows:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',   // PRIMARY
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

### 1.3 Global CSS — `src/app/globals.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-white dark:bg-[#0a0f0a] text-green-900 dark:text-green-50 font-sans antialiased;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { @apply bg-green-50 dark:bg-[#111b11]; }
  ::-webkit-scrollbar-thumb { @apply bg-green-300 dark:bg-green-700 rounded-full; }
}

@layer components {
  /* Buttons */
  .btn-primary {
    @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg
           bg-green-600 hover:bg-green-700 active:bg-green-800
           text-white font-medium text-sm transition-colors duration-150
           disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .btn-secondary {
    @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg
           border border-green-600 text-green-700 dark:text-green-400
           hover:bg-green-50 dark:hover:bg-green-900/30
           font-medium text-sm transition-colors duration-150
           disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .btn-ghost {
    @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg
           text-green-700 dark:text-green-400
           hover:bg-green-100 dark:hover:bg-green-900/30
           font-medium text-sm transition-colors duration-150;
  }
  .btn-danger {
    @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg
           bg-red-600 hover:bg-red-700 text-white font-medium text-sm
           transition-colors duration-150 disabled:opacity-50;
  }

  /* Card */
  .card {
    @apply bg-white dark:bg-[#1a2e1a]
           border border-green-200 dark:border-green-800
           rounded-xl shadow-sm;
  }

  /* Form elements */
  .input {
    @apply w-full px-3 py-2 rounded-lg text-sm
           bg-white dark:bg-[#111b11]
           border border-green-200 dark:border-green-700
           text-green-900 dark:text-green-50
           placeholder-gray-400 dark:placeholder-gray-500
           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
           transition duration-150;
  }
  .label {
    @apply block text-sm font-medium text-green-800 dark:text-green-300 mb-1;
  }
  .field-error {
    @apply text-red-600 dark:text-red-400 text-xs mt-1;
  }

  /* Tables */
  .table-base { @apply w-full text-sm text-left; }
  .table-base thead {
    @apply bg-green-50 dark:bg-green-900/40
           text-green-700 dark:text-green-300 text-xs uppercase tracking-wider;
  }
  .table-base thead th { @apply px-4 py-3 font-semibold; }
  .table-base tbody tr {
    @apply border-t border-green-100 dark:border-green-800/50
           hover:bg-green-50/50 dark:hover:bg-green-900/20 transition-colors duration-100;
  }
  .table-base tbody td { @apply px-4 py-3 text-green-900 dark:text-green-100; }

  /* Badges */
  .badge-green {
    @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
           bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300;
  }
  .badge-red {
    @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
           bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400;
  }
  .badge-yellow {
    @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
           bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400;
  }
  .badge-gray {
    @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
           bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400;
  }

  /* Stat cards */
  .stat-card       { @apply card p-5 flex flex-col gap-1; }
  .stat-value      { @apply text-2xl font-bold text-green-900 dark:text-green-50; }
  .stat-label      { @apply text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide; }
  .stat-sub        { @apply text-sm text-green-700 dark:text-green-400 font-medium; }

  /* Layout helpers */
  .page-title      { @apply text-2xl font-bold text-green-900 dark:text-green-50; }
  .page-subtitle   { @apply text-sm text-gray-500 dark:text-gray-400 mt-0.5; }
  .section-title   { @apply text-lg font-semibold text-green-900 dark:text-green-50; }
}
```

### 1.4 Theme Toggle Component

```typescript
// src/components/ui/ThemeToggle.tsx
'use client'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored === 'dark' || (!stored && prefersDark)
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    <button onClick={toggle} className="btn-ghost p-2 rounded-lg">
      {dark
        ? <Sun size={18} className="text-green-400" />
        : <Moon size={18} className="text-green-700" />}
    </button>
  )
}
```

---

## 2. LAYOUT & NAVIGATION

### 2.1 Sidebar

```
Light: bg-green-50  border-r border-green-200
Dark:  bg-[#111b11] border-r border-green-800
Width: 240px (fixed). Collapses to drawer on mobile (< md).
```

Structure and nav item styles:
```
Logo area:
  "🏫 SchoolOps Pro" — font-bold text-green-700 dark:text-green-400

Section labels:
  text-xs uppercase tracking-widest text-gray-400 px-3 mb-1 mt-4

Nav item default:
  flex items-center gap-3 px-3 py-2 rounded-lg text-sm
  text-green-800 dark:text-green-300
  hover:bg-green-100 dark:hover:bg-green-900/40
  transition-colors duration-150 cursor-pointer

Nav item active:
  bg-green-600 text-white font-medium
  hover:bg-green-700

Bottom:
  School name (font-medium text-green-800 dark:text-green-300)
  Admin name (text-sm text-gray-500)
  Logout button (btn-ghost text-red-600 dark:text-red-400 w-full justify-start)
```

Sections and links:
```
MAIN
  Dashboard        /dashboard
  Students         /students
  Teachers         /teachers
  Classes          /classes

FINANCE
  Payments         /payments

ATTENDANCE
  Students         /attendance/students
  Teachers         /attendance/teachers

COMMUNICATION
  SMS Center       /sms
```

### 2.2 Top Bar

```
Light: bg-white     border-b border-green-200   shadow-sm
Dark:  bg-[#0a0f0a] border-b border-green-800/50

Left:  current page title (text-lg font-semibold text-green-900 dark:text-green-50)
Right: ThemeToggle + user avatar circle (bg-green-600 text-white initials)
```

### 2.3 Dashboard Shell Layout

```
Full height: flex h-screen overflow-hidden

Left:  Sidebar (w-60 shrink-0, hidden on mobile → slide-in drawer)
Right: flex flex-col flex-1 overflow-hidden
  Top:     TopBar (h-16 shrink-0)
  Content: overflow-y-auto bg-white dark:bg-[#0a0f0a]
             p-6 space-y-6 max-w-7xl mx-auto w-full
```

---

## 3. PROJECT STRUCTURE

```
schoolops-pro/
├── AGENT.md
├── .env.local
├── .env.example
├── .gitignore
├── next.config.js
├── tailwind.config.ts
├── package.json
│
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 20240101000000_init_schools.sql
│       ├── 20240101000001_init_users.sql
│       ├── 20240101000002_init_classes.sql
│       ├── 20240101000003_init_students.sql
│       ├── 20240101000004_init_teachers.sql
│       ├── 20240101000005_init_payments.sql
│       ├── 20240101000006_init_student_attendance.sql
│       ├── 20240101000007_init_teacher_attendance.sql
│       ├── 20240101000008_init_sms_logs.sql
│       ├── 20240101000009_views.sql
│       ├── 20240101000010_rls_policies.sql
│       └── 20240101000011_updated_at_triggers.sql
│
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx                      ← redirect to /dashboard
│   │   ├── (auth)/login/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx                ← sidebar + topbar shell
│   │       ├── dashboard/page.tsx
│   │       ├── students/page.tsx
│   │       ├── students/new/page.tsx
│   │       ├── students/[id]/page.tsx
│   │       ├── teachers/page.tsx
│   │       ├── teachers/new/page.tsx
│   │       ├── classes/page.tsx
│   │       ├── classes/new/page.tsx
│   │       ├── payments/page.tsx
│   │       ├── payments/new/page.tsx
│   │       ├── attendance/students/page.tsx
│   │       ├── attendance/teachers/page.tsx
│   │       └── sms/page.tsx
│   │
│   ├── app/api/sms/route.ts
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── Pagination.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── students/
│   │   │   ├── StudentForm.tsx
│   │   │   ├── StudentTable.tsx
│   │   │   └── PaymentHistory.tsx
│   │   ├── payments/
│   │   │   └── PaymentForm.tsx
│   │   ├── attendance/
│   │   │   ├── AttendanceGrid.tsx
│   │   │   └── AttendanceSummary.tsx
│   │   └── sms/
│   │       ├── SMSComposer.tsx
│   │       └── SMSConfirmModal.tsx
│   │
│   ├── lib/
│   │   ├── supabase/client.ts
│   │   ├── supabase/server.ts
│   │   ├── supabase/admin.ts
│   │   ├── supabase/types.ts
│   │   ├── sms/provider.ts
│   │   └── utils/
│   │       ├── currency.ts
│   │       ├── date.ts
│   │       └── cn.ts                     ← clsx helper
│   │
│   ├── hooks/
│   │   ├── useSchool.ts
│   │   ├── useStudents.ts
│   │   ├── usePayments.ts
│   │   └── useAttendance.ts
│   │
│   └── types/index.ts
```

---

## 4. ENVIRONMENT VARIABLES

### `.env.example`
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SMS_API_KEY=your_sms_api_key
SMS_API_BASE_URL=https://your-sms-provider.com/api
SMS_SENDER_ID=SchoolOps
```

**Rules:**
- `NEXT_PUBLIC_*` are safe to expose to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` and `SMS_API_KEY` are **server-only**. Never import in client components.

---

## 5. DATABASE MIGRATIONS

Write one SQL file per migration. Run in order. **Never edit a migration after it has been run.**

### Migration Rules (CRITICAL)
- NEVER drop a column.
- NEVER rename a column.
- NEVER drop a table.
- Only ADD new tables or nullable columns in future migrations.
- Every new column must be NULLABLE or have a DEFAULT.
- All monetary values: `NUMERIC(12,2)` — never FLOAT.
- All primary keys: `UUID` with `DEFAULT gen_random_uuid()`.
- Every table: `id`, `school_id`, `created_at`, `updated_at`.

---

### `20240101000000_init_schools.sql`
```sql
CREATE TABLE schools (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  logo_url          TEXT,
  address           TEXT,
  phone             TEXT,
  email             TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'basic',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `20240101000001_init_users.sql`
```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'admin'
               CHECK (role IN ('admin', 'accountant', 'teacher', 'receptionist')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_school_id ON users(school_id);
```

### `20240101000002_init_classes.sql`
```sql
CREATE TABLE classes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name             TEXT NOT NULL,
  term_fee_amount  NUMERIC(12,2) NOT NULL CHECK (term_fee_amount >= 0),
  academic_year    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
CREATE INDEX idx_classes_school_id ON classes(school_id);
```

### `20240101000003_init_students.sql`
```sql
CREATE TABLE students (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  class_id         UUID REFERENCES classes(id) ON DELETE SET NULL,
  full_name        TEXT NOT NULL,
  admission_number TEXT,
  date_of_birth    DATE,
  gender           TEXT CHECK (gender IN ('male', 'female', 'other')),
  parent_name      TEXT,
  parent_phone     TEXT,
  parent_email     TEXT,
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_class_id  ON students(class_id);
```

### `20240101000004_init_teachers.sql`
```sql
CREATE TABLE teachers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  employee_number TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_teachers_school_id ON teachers(school_id);
```

### `20240101000005_init_payments.sql`
```sql
CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  amount_paid    NUMERIC(12,2) NOT NULL CHECK (amount_paid > 0),
  payment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'momo', 'card', 'other')),
  receipt_number TEXT,
  recorded_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, receipt_number)
);
CREATE INDEX idx_payments_school_id  ON payments(school_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_date       ON payments(payment_date);
```

### `20240101000006_init_student_attendance.sql`
```sql
CREATE TABLE student_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);
CREATE INDEX idx_student_att_school_id ON student_attendance(school_id);
CREATE INDEX idx_student_att_date      ON student_attendance(attendance_date);
CREATE INDEX idx_student_att_student   ON student_attendance(student_id);
```

### `20240101000007_init_teacher_attendance.sql`
```sql
CREATE TABLE teacher_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, attendance_date)
);
CREATE INDEX idx_teacher_att_school_id ON teacher_attendance(school_id);
CREATE INDEX idx_teacher_att_date      ON teacher_attendance(attendance_date);
```

### `20240101000008_init_sms_logs.sql`
```sql
CREATE TABLE sms_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id        UUID REFERENCES students(id) ON DELETE SET NULL,
  sent_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_phone      TEXT NOT NULL,
  message           TEXT NOT NULL,
  sms_type          TEXT NOT NULL DEFAULT 'fee_reminder'
                      CHECK (sms_type IN ('fee_reminder', 'general', 'bulk')),
  status            TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  provider_response TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_logs_school_id  ON sms_logs(school_id);
CREATE INDEX idx_sms_logs_student_id ON sms_logs(student_id);
CREATE INDEX idx_sms_logs_sent_at    ON sms_logs(sent_at);
```

### `20240101000009_views.sql`
```sql
-- CRITICAL: outstanding is ALWAYS computed here, NEVER stored.
CREATE OR REPLACE VIEW student_fee_summary AS
SELECT
  s.id,
  s.school_id,
  s.full_name,
  s.admission_number,
  s.parent_name,
  s.parent_phone,
  s.is_active,
  c.id                                                   AS class_id,
  c.name                                                 AS class_name,
  c.term_fee_amount,
  COALESCE(s.discount_amount, 0)                         AS discount_amount,
  (c.term_fee_amount - COALESCE(s.discount_amount, 0))   AS total_owed,
  COALESCE(SUM(p.amount_paid), 0)                        AS total_paid,
  GREATEST(0,
    c.term_fee_amount
    - COALESCE(s.discount_amount, 0)
    - COALESCE(SUM(p.amount_paid), 0)
  )                                                      AS outstanding
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN payments p ON p.student_id = s.id
GROUP BY
  s.id, s.school_id, s.full_name, s.admission_number,
  s.parent_name, s.parent_phone, s.is_active,
  c.id, c.name, c.term_fee_amount, s.discount_amount;


CREATE OR REPLACE VIEW school_revenue_summary AS
SELECT
  sfs.school_id,
  COUNT(DISTINCT sfs.id) FILTER (WHERE sfs.is_active)               AS total_active_students,
  COALESCE(SUM(sfs.total_owed)  FILTER (WHERE sfs.is_active), 0)    AS expected_revenue,
  COALESCE(SUM(sfs.total_paid)  FILTER (WHERE sfs.is_active), 0)    AS collected_revenue,
  COALESCE(SUM(sfs.outstanding) FILTER (WHERE sfs.is_active), 0)    AS outstanding_revenue,
  COUNT(DISTINCT sfs.id) FILTER (WHERE sfs.outstanding > 0 AND sfs.is_active) AS defaulters_count
FROM student_fee_summary sfs
GROUP BY sfs.school_id;
```

### `20240101000010_rls_policies.sql`
```sql
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT school_id FROM users WHERE id = auth.uid();
$$;

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY schools_select ON schools FOR SELECT USING (id = get_my_school_id());
CREATE POLICY schools_update ON schools FOR UPDATE USING (id = get_my_school_id());

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select ON users FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY users_update ON users FOR UPDATE USING (school_id = get_my_school_id());

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY classes_select ON classes FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY classes_insert ON classes FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY classes_update ON classes FOR UPDATE USING (school_id = get_my_school_id());
CREATE POLICY classes_delete ON classes FOR DELETE USING (school_id = get_my_school_id());

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY students_select ON students FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY students_insert ON students FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY students_update ON students FOR UPDATE USING (school_id = get_my_school_id());

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY teachers_select ON teachers FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY teachers_insert ON teachers FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY teachers_update ON teachers FOR UPDATE USING (school_id = get_my_school_id());

-- No delete policy on payments — they are immutable
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_select ON payments FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (school_id = get_my_school_id());

ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_att_select ON student_attendance FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY student_att_insert ON student_attendance FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY student_att_update ON student_attendance FOR UPDATE USING (school_id = get_my_school_id());

ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_att_select ON teacher_attendance FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY teacher_att_insert ON teacher_attendance FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY teacher_att_update ON teacher_attendance FOR UPDATE USING (school_id = get_my_school_id());

-- Append-only SMS logs
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sms_logs_select ON sms_logs FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY sms_logs_insert ON sms_logs FOR INSERT WITH CHECK (school_id = get_my_school_id());

ALTER VIEW student_fee_summary OWNER TO authenticated;
ALTER VIEW school_revenue_summary OWNER TO authenticated;
```

### `20240101000011_updated_at_triggers.sql`
```sql
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON schools            FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON classes            FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON students           FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON teachers           FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payments           FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON student_attendance FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON teacher_attendance FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sms_logs           FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
```

---

## 6. SUPABASE CLIENT SETUP

### `src/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `src/lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}
```

### `src/lib/supabase/admin.ts`
```typescript
// SERVER ONLY — never import in client components or pages
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

### `src/lib/utils/cn.ts`
```typescript
import { clsx, type ClassValue } from 'clsx'
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
```

---

## 7. TYPESCRIPT TYPES

### `src/types/index.ts`
```typescript
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type PaymentMethod    = 'cash' | 'bank_transfer' | 'momo' | 'card' | 'other'
export type SmsType          = 'fee_reminder' | 'general' | 'bulk'
export type SmsStatus        = 'success' | 'failed' | 'pending'
export type UserRole         = 'admin' | 'accountant' | 'teacher' | 'receptionist'

export interface School {
  id: string; name: string; logo_url?: string; address?: string
  phone?: string; email?: string; subscription_plan: string
  is_active: boolean; created_at: string; updated_at: string
}

export interface Student {
  id: string; school_id: string; class_id?: string; full_name: string
  admission_number?: string; date_of_birth?: string; gender?: string
  parent_name?: string; parent_phone?: string; parent_email?: string
  discount_amount: number; is_active: boolean
  created_at: string; updated_at: string
}

export interface Teacher {
  id: string; school_id: string; full_name: string; phone?: string
  email?: string; employee_number?: string; is_active: boolean
  created_at: string; updated_at: string
}

export interface Class {
  id: string; school_id: string; name: string
  term_fee_amount: number; academic_year?: string
  created_at: string; updated_at: string
}

export interface Payment {
  id: string; school_id: string; student_id: string
  amount_paid: number; payment_date: string
  payment_method?: PaymentMethod; receipt_number?: string
  recorded_by?: string; notes?: string; created_at: string
}

export interface StudentAttendance {
  id: string; school_id: string; student_id: string
  attendance_date: string; status: AttendanceStatus
  marked_by?: string; notes?: string
}

export interface TeacherAttendance {
  id: string; school_id: string; teacher_id: string
  attendance_date: string; status: AttendanceStatus; marked_by?: string
}

export interface SmsLog {
  id: string; school_id: string; student_id?: string; sent_by?: string
  parent_phone: string; message: string; sms_type: SmsType
  status: SmsStatus; provider_response?: string; sent_at: string
}

// View types — these come from the DB views
export interface StudentFeeSummary {
  id: string; school_id: string; full_name: string; admission_number?: string
  parent_name?: string; parent_phone?: string; is_active: boolean
  class_id?: string; class_name?: string; term_fee_amount: number
  discount_amount: number; total_owed: number; total_paid: number; outstanding: number
}

export interface SchoolRevenueSummary {
  school_id: string; total_active_students: number
  expected_revenue: number; collected_revenue: number
  outstanding_revenue: number; defaulters_count: number
}
```

---

## 8. UI COMPONENT SPECIFICATIONS

All components use the CSS classes from Section 1.3. Never invent new color values.

### `Button.tsx`
- Props: `variant` ('primary' | 'secondary' | 'ghost' | 'danger'), `size` ('sm' | 'md'), `loading`, `icon`, standard button props
- Use `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger`
- Loading: show `<Loader2 size={14} className="animate-spin" />` and disable

### `StatCard.tsx`
- Props: `label`, `value`, `sub?`, `icon?`, `highlight?` ('green' | 'red' | 'yellow')
- Uses `.stat-card .stat-value .stat-label .stat-sub`
- Icon: sits in `bg-green-100 dark:bg-green-900/40 rounded-lg p-2` box in top-right
- `highlight='red'`: adds `border-red-300 dark:border-red-700` to the card

### `Modal.tsx`
- Backdrop: `fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center`
- Panel: `card max-w-md w-full mx-4 p-6`
- Header: `.section-title` + X button top-right (`btn-ghost p-1`)
- Trap focus, close on backdrop click and Escape key

### `Badge.tsx`
- Status map: `active | present | success → badge-green`; `inactive | absent | failed → badge-red`; `late | pending → badge-yellow`; `excused | other → badge-gray`

### `EmptyState.tsx`
- Centered, icon (48px, `text-green-300 dark:text-green-700`), title (`.section-title`), optional description + action button

### `SearchInput.tsx`
- `.input` with `pl-9`, `Search` icon absolutely positioned left, `text-gray-400 size={16}`

### `Skeleton.tsx`
- `animate-pulse bg-green-100 dark:bg-green-900/40 rounded`
- Variants: line (h-4 w-full), circle (h-10 w-10 rounded-full), card (h-24 w-full rounded-xl)

### `Pagination.tsx`
- "Showing X–Y of Z" text + Prev/Next buttons (`.btn-secondary` size sm)
- Disable Prev on page 1, Next on last page

---

## 9. PAGE SPECIFICATIONS

### Login Page — `/login`

```
Full-page centered: min-h-screen bg-white dark:bg-[#0a0f0a] flex items-center justify-center

Card: card p-8 w-full max-w-sm
  Logo: green circle with "S" initial, or app name in green-600
  Heading: "Welcome back" — text-2xl font-bold text-green-900 dark:text-green-50
  Subheading: "Sign in to SchoolOps Pro" — text-sm text-gray-500

  Form:
    Email field (label + input)
    Password field (label + input + show/hide toggle with Eye icon)
    Error banner: bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 rounded-lg p-3 text-sm
    Submit: btn-primary w-full (shows spinner when loading)

  Footer: "SchoolOps Pro" small text centered below card (text-xs text-gray-400)
```

### Dashboard — `/dashboard`

**KPI Grid 1** — `grid grid-cols-2 lg:grid-cols-4 gap-4`
```
Card 1: Total Active Students   — icon: Users,       sub: "+X this week"
Card 2: Expected Revenue        — icon: FileText,     sub: "This term"
Card 3: Collected Revenue       — icon: CheckCircle,  sub: "X% collection rate"
Card 4: Outstanding Balance     — icon: AlertCircle,  sub: "X defaulters", highlight='red' if > 0
```

**KPI Grid 2** — `grid grid-cols-1 md:grid-cols-3 gap-4`
```
Card 5: Student Attendance Today — icon: GraduationCap, sub: "X present / Y absent"
Card 6: Teacher Attendance Today — icon: UserCheck,      sub: "X present / Y absent"
Card 7: Collection Rate Progress — custom: label + progress bar
  Progress bar: bg-green-100 dark:bg-green-900/40 rounded-full h-3
  Fill:         bg-green-600 rounded-full h-3 (width = rate%)
  Label below:  "GHS X,XXX of GHS Y,YYY collected"
```

**Defaulters Table** — full-width `card`
```
Header row: "Students with Outstanding Fees" (section-title) +
            "Send All Reminders" btn-secondary on the right

table-base columns:
  Name | Class | Term Fee | Paid | Outstanding | Parent Phone | Action

Outstanding column styling:
  > 0  → font-semibold text-red-600 dark:text-red-400
  = 0  → badge-green "Fully Paid"

Action: icon btn-ghost (MessageSquare size=16) with tooltip "Send SMS reminder"
Empty state if no defaulters: EmptyState with CheckCircle icon "All fees are up to date"
```

### Students List — `/students`

```
PageHeader: page-title "Students" + btn-primary "Add Student" (Plus icon)

Filter bar: card p-4 mb-4, flex gap-3 flex-wrap
  SearchInput placeholder="Search by name or admission no."
  Select "All Classes" | class list
  Select "All Students" | "Has Balance" | "Fully Paid" | "Inactive"
  btn-ghost "Clear" (only shown when filters are active)

table-base:
  Checkbox | Adm. No | Name | Class | Parent Phone | Outstanding | Status | Actions

Outstanding:
  = 0 & is_active  → badge-green "Paid"
  > 0 & is_active  → text-red-600 font-medium formatted amount
  !is_active        → badge-gray "Inactive"
  no class          → badge-yellow "No Class"

Status: badge-green "Active" / badge-gray "Inactive"

Actions (icon buttons, btn-ghost):
  Eye (view) | Plus (add payment) | MessageSquare (SMS) | Pencil (edit)

Bulk action bar (appears when rows checked):
  "X selected" + btn-secondary "Send SMS to Selected"

Pagination: show 20 per page
```

### Student Detail — `/students/[id]`

```
Breadcrumb: "← Students" btn-ghost at top

Two-column grid (gap-6, lg:grid-cols-2):

LEFT — card "Student Information" p-5
  Header: student name (text-xl font-bold) + Edit btn-secondary top-right
  Details list (dl, space-y-3):
    Class, Admission No., Date of Birth, Gender
  Divider: border-t border-green-100 dark:border-green-800
  "Parent / Guardian":
    Name, Phone, Email

RIGHT — card "Fee Summary" p-5
  Each row: justify-between flex, label (text-gray-500) + value (font-semibold)
    Term Fee:    GHS X,XXX
    Discount:   -GHS X,XXX   (text-green-600 if > 0)
    Total Owed:  GHS X,XXX
    Total Paid:  GHS X,XXX   text-green-600
  Divider
    Outstanding: GHS X,XXX   text-red-600 font-bold text-lg (if > 0)
                 GHS 0.00    badge-green "Fully Paid" (if = 0)
  Buttons: btn-primary "Add Payment" + btn-secondary "Send SMS Reminder"

BELOW full-width — card "Payment History"
  table-base: Date | Amount | Method | Receipt No. | Notes
  Empty state if empty
```

### Payment Form (modal)

```
Fields:
  Amount *         input type="number" min="0.01" step="0.01"
  Payment Date *   input type="date" max=today
  Payment Method   Select: Cash / Bank Transfer / MoMo / Card / Other
  Receipt Number   input placeholder="Auto-generated if left blank"
  Notes            textarea rows=2 optional

Overpayment warning (yellow banner):
  bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg p-3 text-sm
  "⚠ This amount exceeds the outstanding balance of GHS X. Continue?"

Buttons: btn-primary "Record Payment" | btn-ghost "Cancel"
```

### Attendance Page — `/attendance/students`

```
Filter bar: [Date picker, default today] [Class selector]
Action bar: btn-secondary "Mark All Present" | btn-primary "Save Attendance" (right-aligned)

table-base:
  Name | Admission No | Status Toggle | Notes

Status toggle row (4 buttons side-by-side):
  Present  → selected: bg-green-600 text-white,  default: btn-secondary text-sm py-1 px-3
  Absent   → selected: bg-red-600 text-white,    default: btn-secondary text-sm py-1 px-3
  Late     → selected: bg-yellow-500 text-white, default: btn-secondary text-sm py-1 px-3
  Excused  → selected: bg-gray-500 text-white,   default: btn-secondary text-sm py-1 px-3

Summary strip (below table):
  card p-3 flex gap-4
  badge-green "Present: X" | badge-red "Absent: X" | badge-yellow "Late: X" | badge-gray "Excused: X"

Save uses UPSERT on (student_id, attendance_date). Show success toast on complete.
```

### SMS Center — `/sms`

```
Tab bar: 3 tabs
  Active tab:   border-b-2 border-green-600 text-green-700 dark:text-green-400 font-medium
  Default tab:  text-gray-500 hover:text-green-700 dark:hover:text-green-400

TAB 1 — Single Student
  SearchInput to find a student
  Selected student card: card p-3 showing name, class, outstanding badge
  Textarea (message, pre-filled with template, 160 char limit)
  Character counter: text-xs text-right text-gray-400 (red when > 160)
  btn-primary "Send SMS"

TAB 2 — Selected Students
  table-base with checkbox column
  Checkbox | Name | Class | Outstanding | Parent Phone
  "Select All" checkbox in header
  Selected count: badge-green "X selected" (shown when > 0)
  Message textarea + char counter
  btn-primary "Send to X Students" → SMSConfirmModal

TAB 3 — All Defaulters
  card info panel: "X students currently have outstanding fees"
  Message preview box: bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm italic
  btn-primary "Send Reminders to All X Defaulters" → SMSConfirmModal

SMSConfirmModal:
  Title: "Confirm Bulk SMS"
  "You are about to send X SMS messages."
  Message preview: bg-green-50 dark:bg-[#111b11] rounded-lg p-3 text-sm border border-green-200 dark:border-green-700
  Warning: "This action cannot be undone." text-sm text-gray-500 mt-2
  Buttons: btn-primary "Send Now" | btn-ghost "Cancel"

Post-send results toast:
  Success: green toast "✓ X messages sent successfully"
  Mixed:   yellow toast "X sent, Y failed — see log for details"

SMS Log (below tabs): card "Recent SMS Activity"
  table-base: Date & Time | Student | Phone | Type | Status | Preview
  status column: badge-green / badge-red
  Show last 50 entries
```

---

## 10. SMS PROVIDER

### `src/lib/sms/provider.ts`
```typescript
export interface SmsResult {
  success: boolean
  providerResponse: string
}

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  try {
    const res = await fetch(`${process.env.SMS_API_BASE_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SMS_API_KEY}`,
      },
      body: JSON.stringify({ to: phone, from: process.env.SMS_SENDER_ID, message }),
    })
    const data = await res.json()
    return { success: res.ok, providerResponse: JSON.stringify(data) }
  } catch (err) {
    return { success: false, providerResponse: String(err) }
  }
}

export function buildFeeReminderMessage(p: {
  parentName?: string; studentName: string; className: string
  outstanding: number; schoolName: string; currency?: string
}): string {
  const c = p.currency ?? 'GHS'
  const parent = p.parentName ?? 'Parent/Guardian'
  return `Dear ${parent}, your ward ${p.studentName} (${p.className}) has an outstanding fee balance of ${c} ${p.outstanding.toFixed(2)}. Please make payment at ${p.schoolName}. Thank you.`
}
```

---

## 11. SMS API ROUTE

### `src/app/api/sms/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms }           from '@/lib/sms/provider'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('school_id').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { recipients } = await req.json() as {
    recipients: Array<{ student_id?: string; phone: string; message: string }>
  }
  if (!recipients?.length) return NextResponse.json({ error: 'No recipients' }, { status: 400 })

  const admin = createAdminClient()
  const results: Array<{ phone: string; success: boolean }> = []

  for (const r of recipients) {
    const result = await sendSms(r.phone, r.message)
    await admin.from('sms_logs').insert({
      school_id:         me.school_id,
      student_id:        r.student_id ?? null,
      sent_by:           user.id,
      parent_phone:      r.phone,
      message:           r.message,
      sms_type:          recipients.length === 1 ? 'fee_reminder' : 'bulk',
      status:            result.success ? 'success' : 'failed',
      provider_response: result.providerResponse,
    })
    results.push({ phone: r.phone, success: result.success })
  }

  return NextResponse.json({
    results,
    successCount: results.filter(r => r.success).length,
    failCount:    results.filter(r => !r.success).length,
  })
}
```

---

## 12. MIDDLEWARE

### `src/middleware.ts`
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user && !path.startsWith('/login') && !path.startsWith('/api')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  if (user && path === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## 13. UTILITY FUNCTIONS

```typescript
// src/lib/utils/currency.ts
export function formatCurrency(amount: number, currency = 'GHS'): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount)
}

// src/lib/utils/date.ts
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(date))
}
export function today(): string { return new Date().toISOString().split('T')[0] }
export function isFutureDate(date: string): boolean { return new Date(date) > new Date() }
```

---

## 14. PACKAGES TO INSTALL

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query
npm install react-hook-form zod @hookform/resolvers
npm install date-fns
npm install sonner
npm install lucide-react
npm install clsx
```

---

## 15. BUSINESS LOGIC RULES

### Outstanding Balance (MOST CRITICAL RULE)
```
Outstanding = MAX(0, class.term_fee_amount - student.discount_amount - SUM(payments.amount_paid))
```
- **NEVER store this. ALWAYS compute from `student_fee_summary` view.**
- No class assigned → outstanding = 0.
- SQL: `GREATEST(0, ...)`. JS fallback: `Math.max(0, ...)`.

### Payment Rules
- No UPDATE or DELETE on payments — no such RLS policy exists by design.
- Auto-generate receipt: `REC-${Date.now()}` if blank.
- Warn (don't block) if amount > outstanding.
- Date cannot be future.

### Attendance Rules
- UPSERT with `onConflict: 'student_id,attendance_date'` — never raw INSERT.
- Attendance rate = (present + late) / total active × 100.

### SMS Rules
- Loop — one API call per recipient.
- Log every attempt immediately after the API call, before moving to next.
- Store the resolved message text (variables already filled in).

---

## 16. CODING STANDARDS

- TypeScript strict mode. Zero `any` types.
- Server Components for all data-fetching. `'use client'` only for interactive components.
- Forms: `react-hook-form` + `zod` always.
- Every Supabase query checks `error`. Show `sonner` toast on failure.
- Tables show Skeleton rows while loading, not spinners.
- `cn()` from clsx for all conditional class merging.
- No hardcoded `school_id` — always from auth session.
- **No custom CSS. Tailwind only. Only the colors defined in Section 1.**

---

## 17. WHAT NOT TO BUILD IN MVP

Do NOT build:
- Terms / academic year management
- Subjects, exams, grades, result slips
- Parent or teacher login portals
- Online payments (MoMo API, card, bank)
- Automated / scheduled SMS
- Payment reversals
- Expense tracking or P&L
- Payroll
- Role & permissions system (use `users.role` only)
- Super admin dashboard
- Mobile apps
- PDF export
- Email notifications

---

## 18. BUILD SEQUENCE

Build in this exact order. Do not skip steps. Verify each step works before the next.

```
Step 1:  npx create-next-app@latest schoolops-pro --typescript --tailwind --app
Step 2:  Install all packages (Section 14)
Step 3:  Configure tailwind.config.ts (Section 1.2)
Step 4:  Replace globals.css (Section 1.3)
Step 5:  Create cn.ts utility
Step 6:  Create all migration SQL files (Section 5)
Step 7:  supabase db push — apply all migrations
Step 8:  supabase gen types typescript > src/lib/supabase/types.ts
Step 9:  Create supabase client files (Section 6)
Step 10: Create src/types/index.ts (Section 7)
Step 11: Create utility functions (Section 13)
Step 12: Build all UI primitives in src/components/ui/ (Section 8)
Step 13: Build ThemeToggle — test light/dark switch in browser
Step 14: Build Sidebar + TopBar + dashboard shell layout
Step 15: Create middleware (Section 12)
Step 16: Build login page — test auth flow end-to-end
Step 17: Verify dark mode works on login page
Step 18: Build Classes CRUD (list + create)
Step 19: Build Students CRUD (list + create + detail)
Step 20: Build PaymentForm modal — record a payment
Step 21: Check dashboard outstanding balance = student_fee_summary view value
Step 22: Build Teachers CRUD
Step 23: Build Dashboard page (all KPI cards + defaulters table)
Step 24: Build Student Attendance page
Step 25: Build Teacher Attendance page
Step 26: Build SMS Center + API route (Sections 10–11)
Step 27: Test SMS with a real phone number
Step 28: Dark mode audit — check every page in dark mode
Step 29: End-to-end test: school → class → student → payment → dashboard
Step 30: RLS audit: sign in as School B, confirm cannot read School A data
```

---

## 19. DEFINITION OF DONE

The MVP is complete when every item below is verified:

- [ ] Login/logout works with Supabase Auth.
- [ ] Unauthenticated users are redirected to /login.
- [ ] **Dark mode toggle works on every single page and persists on refresh.**
- [ ] **All pages use white/green in light mode and dark-tinted/green in dark mode only.**
- [ ] **No hardcoded colors outside the palette defined in Section 1.**
- [ ] Dashboard loads with correct financial KPIs.
- [ ] Collection rate progress bar shows correct percentage.
- [ ] Classes can be created, listed, and edited.
- [ ] Students can be registered with class assignment and discount.
- [ ] Teachers can be registered, listed, and edited.
- [ ] Payments can be recorded; payment history is visible on student detail.
- [ ] Outstanding balance is correct after each payment.
- [ ] Outstanding balance never displays as a negative number.
- [ ] Dashboard defaulters list shows only students where outstanding > 0.
- [ ] Student attendance can be marked by class and date using toggle buttons.
- [ ] Teacher attendance can be marked by date.
- [ ] Today's attendance rates display correctly on dashboard.
- [ ] Single SMS can be sent to one parent and is logged.
- [ ] Bulk SMS to all defaulters shows confirmation modal with count.
- [ ] All SMS results (success and failed) appear in the SMS log table.
- [ ] RLS verified: School B user cannot access any School A data.

---

*End of AGENT.md*
