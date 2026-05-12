"use client"

import { useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import { useApp } from '@/lib/app-context'

const TOUR_STORAGE_KEY = 'office-tour-seen-v2'

// Each step has an optional navigateTo (fires before the step renders)
// and targets either a sidebar nav item or a page element
const STEPS: Array<{
  navigateTo?: string
  element: string
  popover: { title: string; description: string; side?: 'right' | 'left' | 'top' | 'bottom'; align?: 'start' | 'center' | 'end' }
}> = [
  // ── Overview ────────────────────────────────────────────────────────
  {
    navigateTo: 'overview',
    element: '[data-tour="nav-overview"]',
    popover: {
      title: '👋 Welcome to Cascadia Ops',
      description: 'This tour walks you through each section. Click <strong>Next →</strong> to see what\'s inside.<br/><br/><strong>Overview</strong> is your morning dashboard — everything at a glance before you start your day.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="kpi-cards"]',
    popover: {
      title: '📊 Daily Snapshot',
      description: 'These cards update in real time. <strong>Active Crew</strong> shows who\'s on payroll, <strong>Active Projects</strong> shows open jobs, and <strong>Pending Sheets</strong> is your to-do list for approvals.<br/><br/>If Pending Sheets is above 0, that\'s your first task of the day.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="contracts-section"]',
    popover: {
      title: '📋 Active Projects at a Glance',
      description: 'Below the KPIs, all active projects are listed with production progress bars showing trees or acres completed vs. the project target.<br/><br/>Click <strong>View All</strong> to go to the full projects page.',
      side: 'top', align: 'start',
    },
  },

  // ── Timesheets ───────────────────────────────────────────────────────
  {
    navigateTo: 'timeSheets',
    element: '[data-tour="nav-timeSheets"]',
    popover: {
      title: '🕐 Timesheets',
      description: 'Foremen submit timesheets from the field each day. This is where you review and approve them.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="timesheet-filters"]',
    popover: {
      title: '🔍 Filter by Status',
      description: 'Use these tabs to sort timesheets by <strong>Pending</strong> (needs your review), <strong>Approved</strong>, <strong>Rejected</strong>, or <strong>Draft</strong>.<br/><br/>Start with Pending every morning — those are waiting on you.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="timesheets-list"]',
    popover: {
      title: '✅ Review & Approve',
      description: 'Click any row to expand the full submission — crew members, hours, bags, work type, unit notes, and any photos.<br/><br/>Hit <strong>Approve</strong> to lock it in. Approved timesheets automatically roll up into project and unit totals. <strong>Reject</strong> sends it back to the foreman.',
      side: 'top', align: 'start',
    },
  },

  // ── Submit Timesheet ─────────────────────────────────────────────────
  {
    navigateTo: 'officeTimesheet',
    element: '[data-tour="nav-officeTimesheet"]',
    popover: {
      title: '📋 Submit Timesheet',
      description: 'When a foreman calls in or submits on paper, you enter it here on their behalf.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="office-ts-setup"]',
    popover: {
      title: '1️⃣ Set Up the Submission',
      description: 'Pick the <strong>date</strong>, <strong>project</strong>, <strong>foreman</strong>, and optionally a <strong>crew set</strong> to pre-fill the crew list. These four fields drive everything below.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="office-ts-employees"]',
    popover: {
      title: '2️⃣ Enter Hours Per Employee',
      description: 'Each crew member gets a row. Fill in <strong>hours</strong>, <strong>work type</strong>, and <strong>bags</strong>. Drivers get a drive hours field too.<br/><br/>Hit <strong>Submit</strong> when done — it goes straight to the Timesheets queue for your own review.',
      side: 'top', align: 'start',
    },
  },

  // ── Contracts ────────────────────────────────────────────────────────
  {
    navigateTo: 'contracts',
    element: '[data-tour="nav-contracts"]',
    popover: {
      title: '📁 Projects',
      description: 'Your master job list — every project for Cascadia and Ramos, grouped by landowner.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="contracts-filters"]',
    popover: {
      title: '🔎 Filter by Status',
      description: 'Use the left panel to filter projects by <strong>Active</strong>, <strong>Upcoming</strong>, <strong>Seasonal</strong>, <strong>Closed</strong>, and more.<br/><br/>The search bar at the top filters by name. Projects are grouped by landowner (Chilton, DNR, Weyerhaeuser, etc.).',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="contracts-list"]',
    popover: {
      title: '📌 Project Details',
      description: 'Click any project to open its detail view — <strong>Units</strong> with progress, <strong>Partial Payments</strong> received so far, <strong>Files</strong>, <strong>Notes</strong>, and <strong>Contacts</strong>.<br/><br/>This is your primary reference for job status and what\'s owed.',
      side: 'right', align: 'start',
    },
  },

  // ── Contacts ────────────────────────────────────────────────────────
  {
    navigateTo: 'contacts',
    element: '[data-tour="nav-contacts"]',
    popover: {
      title: '📇 Contacts',
      description: 'Quick-access directory of landowners, CORs, inspectors, and agency contacts — all linked to their projects.<br/><br/>When you need to reach someone on a job, their info is here. Click any contact to see which projects they\'re on.',
      side: 'right', align: 'start',
    },
  },

  // ── Calendar ────────────────────────────────────────────────────────
  {
    navigateTo: 'calendar',
    element: '[data-tour="nav-calendar"]',
    popover: {
      title: '📅 Calendar',
      description: 'Visual overview of all active projects across time.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="calendar-heatmap"]',
    popover: {
      title: '🟩 Activity Heatmap',
      description: 'Each day is shaded by how much is happening — darker green means more project activity. Click any day to see what\'s scheduled.<br/><br/>Compliance deadlines appear as colored pills below the calendar so nothing falls through the cracks.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="calendar-gantt"]',
    popover: {
      title: '📊 Project Timeline',
      description: 'The Gantt chart shows every project\'s start-to-end duration side by side. The vertical line is today.<br/><br/>Use this to spot scheduling overlaps, check when projects wrap up, and plan crew moves between jobs.',
      side: 'top', align: 'start',
    },
  },

  // ── Files ───────────────────────────────────────────────────────────
  {
    navigateTo: 'files',
    element: '[data-tour="nav-files"]',
    popover: {
      title: '🗂️ Files',
      description: 'Company documents organized by project, stored in Google Drive.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="files-tree-toggle"]',
    popover: {
      title: '📂 Operations Files',
      description: 'All field-facing documents are organized here — maps, spec sheets, driving directions, and unit photos.<br/><br/>Files are grouped by <strong>Landowner → Project → Maps & Specs / Units</strong>. Use the breadcrumb trail to navigate, or click directly into a project folder.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="files-browser"]',
    popover: {
      title: '📂 Browse & Upload',
      description: 'Navigate folders using the breadcrumb trail. Click any folder to open it.<br/><br/>Use the <strong>Upload</strong> button to add files. Folder structure is: <em>Landowner → Project → Maps & Specs / Units</em>. Upload signed contracts to <strong>Pricing & Originals</strong> immediately on award.',
      side: 'top', align: 'start',
    },
  },

  // ── Work Tracker ────────────────────────────────────────────────────
  {
    navigateTo: 'workTracker',
    element: '[data-tour="nav-workTracker"]',
    popover: {
      title: '✅ Work Tracker',
      description: 'Internal task board for the office team and Jaime.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="tracker-view-toggle"]',
    popover: {
      title: '🗂 Board or List View',
      description: 'Switch between <strong>Kanban</strong> (visual columns) and <strong>List</strong> (compact rows). Use whichever fits your style.<br/><br/>Tasks move through: To Do → In Progress → Blocked → Done.',
      side: 'bottom', align: 'center',
    },
  },
  {
    element: '[data-tour="tracker-board"]',
    popover: {
      title: '📌 Track Action Items',
      description: 'Add tasks for things like "Get unit county from DNR", "Send updated map to Agustin", or "Follow up on Chilton invoice".<br/><br/>Drag cards between columns as work progresses. The chat panel on the right is for quick back-and-forth with Jaime.',
      side: 'top', align: 'start',
    },
  },

  // ── Crew ────────────────────────────────────────────────────────────
  {
    navigateTo: 'crew',
    element: '[data-tour="nav-crew"]',
    popover: {
      title: '👥 Crew',
      description: 'Full employee roster for Cascadia and Ramos.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="crew-filters"]',
    popover: {
      title: '🔍 Filter the Roster',
      description: 'Filter by role: <strong>Foremen</strong>, <strong>Drivers</strong>, <strong>H2B</strong>, <strong>Office</strong>. Use the company toggle at the top of the page to switch between Cascadia and Ramos employees.<br/><br/>Search by name to find anyone quickly.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="crew-grid"]',
    popover: {
      title: '🪪 Employee Cards',
      description: 'Each card shows the employee\'s role, pay rate, hours this week, and certification status.<br/><br/>Click any card to open the edit sheet — update name, rate, contact info, or upload a profile photo. This is also where you\'d flag a certification as expiring.',
      side: 'top', align: 'start',
    },
  },

  // ── Crew Sets ───────────────────────────────────────────────────────
  {
    navigateTo: 'crewSets',
    element: '[data-tour="nav-crewSets"]',
    popover: {
      title: '👷 Crew Sets',
      description: 'Pre-built crew groupings that foremen select in one tap instead of picking each person individually.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="crew-sets-filters"]',
    popover: {
      title: '📋 Filter by Foreman',
      description: 'Each set belongs to a foreman. Use the filter buttons to see Agustin\'s sets, Maya\'s sets, etc.<br/><br/>When Jaime tells you a foreman has a new regular crew, click <strong>+ New Crew Set</strong> here.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="crew-sets-grid"]',
    popover: {
      title: '🎯 You\'re All Set!',
      description: 'Each card shows the set name, foreman, and member count. Click to view or edit members.<br/><br/>Once a set exists, foremen can select the whole group in one tap from the timesheet wizard — no hunting for names in the field.<br/><br/><strong>That\'s the tour!</strong> Click <strong>Done ✓</strong> to get started. The "Take a tour" button in the sidebar brings this back anytime.',
      side: 'top', align: 'start',
    },
  },
]

export function OfficeTourButton() {
  const { setActivePage } = useApp()

  const startTour = async () => {
    const { driver } = await import('driver.js')

    let pendingNav: string | null = null

    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.22,
      stagePadding: 8,
      stageRadius: 8,
      progressText: 'Step {{current}} of {{total}}',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Done ✓',
      popoverClass: 'cascadia-tour-popover',
      onNextClick: (_el, _step, opts) => {
        const idx = (opts.state.activeIndex ?? 0) + 1
        const next = STEPS[idx]
        if (next?.navigateTo) {
          setActivePage(next.navigateTo)
          setTimeout(() => driverObj.moveNext(), 120)
        } else {
          driverObj.moveNext()
        }
      },
      onPrevClick: (_el, _step, opts) => {
        const idx = (opts.state.activeIndex ?? 0) - 1
        const prev = STEPS[idx]
        if (prev?.navigateTo) {
          setActivePage(prev.navigateTo)
          setTimeout(() => driverObj.movePrevious(), 120)
        } else {
          driverObj.movePrevious()
        }
      },
      onDestroyStarted: () => {
        localStorage.setItem(TOUR_STORAGE_KEY, 'true')
        driverObj.destroy()
      },
      steps: STEPS.map(s => ({
        element: s.element,
        popover: s.popover,
      })),
    })

    // Navigate to first page then start
    setActivePage(STEPS[0].navigateTo!)
    setTimeout(() => driverObj.drive(), 120)
  }

  return (
    <button
      onClick={startTour}
      className="tour-pulse-btn flex w-full items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
    >
      <HelpCircle className="h-3.5 w-3.5 shrink-0" />
      <span>Take a tour</span>
    </button>
  )
}
