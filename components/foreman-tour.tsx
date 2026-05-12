"use client"

import { HelpCircle } from 'lucide-react'
import { useApp } from '@/lib/app-context'

const TOUR_STORAGE_KEY = 'foreman-tour-seen-v1'

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
      title: 'Welcome to Cascadia Ops',
      description: 'This is your daily dashboard. Everything you need is here — your favorite projects, crew info, and quick actions.<br/><br/>Click <strong>Next</strong> to walk through each section.',
      side: 'right', align: 'start',
    },
  },

  // ── My Projects ─────────────────────────────────────────────────────
  {
    navigateTo: 'myContracts',
    element: '[data-tour="nav-myContracts"]',
    popover: {
      title: 'My Projects',
      description: 'All your assigned projects are listed here — sorted with active jobs first.<br/><br/>Tap the <strong>star</strong> on any project to add it to your <strong>Favorites</strong>. Favorites show up on your Overview so you can jump straight to them each morning.',
      side: 'right', align: 'start',
    },
  },

  // ── Timesheets (disabled) ───────────────────────────────────────────
  {
    element: '[data-tour="nav-timeSheets"]',
    popover: {
      title: 'Timesheets',
      description: 'View all submitted timesheets here. You can see the status of each submission — <strong>Pending</strong>, <strong>Approved</strong>, or <strong>Rejected</strong>.<br/><br/>This is your record of what has been submitted. The office reviews and approves entries here.',
      side: 'right', align: 'start',
    },
  },

  // ── Submit Timesheet ────────────────────────────────────────────────
  {
    navigateTo: 'submitTimesheet',
    element: '[data-tour="nav-submitTimesheet"]',
    popover: {
      title: 'Submit Timesheet (Preview)',
      description: 'This is where you will submit your daily crew timesheets. You can <strong>look around the page</strong> to see what it will look like, but it is not active yet.<br/><br/>The wizard walks you through: <strong>Select Project</strong> &rarr; <strong>Select Units</strong> &rarr; <strong>Pick Crew</strong> &rarr; <strong>Enter Hours</strong> &rarr; <strong>Review & Submit</strong>. Training is coming soon.',
      side: 'right', align: 'start',
    },
  },

  // ── Files ───────────────────────────────────────────────────────────
  {
    navigateTo: 'files',
    element: '[data-tour="nav-files"]',
    popover: {
      title: 'Files',
      description: 'Maps, spec sheets, driving directions, and unit documents for your projects — all in one place.<br/><br/>Select a project to see its <strong>Maps & Specs</strong> and <strong>Units</strong> folders. You can download any file directly to your phone for offline use with the Avenza app.',
      side: 'right', align: 'start',
    },
  },

  // ── Expenses (coming soon) ──────────────────────────────────────────
  {
    element: '[data-tour="nav-expenses"]',
    popover: {
      title: 'Expenses (Coming Soon)',
      description: 'Expense tracking is being built. Once live, all credit card charges, fuel receipts, and equipment purchases will be tracked here and tied to specific projects.<br/><br/>Start collecting and organizing your receipts now — this will be important.',
      side: 'right', align: 'start',
    },
  },

  // ── My Crew ─────────────────────────────────────────────────────────
  {
    navigateTo: 'myCrew',
    element: '[data-tour="nav-myCrew"]',
    popover: {
      title: 'My Crew',
      description: 'Your full crew roster — who is active, their role, and contact info.<br/><br/>Use this to check crew availability and find contact information quickly when you are in the field.',
      side: 'right', align: 'start',
    },
  },

  // ── Crew Sets ───────────────────────────────────────────────────────
  {
    navigateTo: 'crewSets',
    element: '[data-tour="nav-crewSets"]',
    popover: {
      title: 'Crew Sets',
      description: 'Pre-built crew groupings for timesheet submission. Instead of picking each person one by one, select a crew set and everyone is added at once.<br/><br/>You can <strong>create new crew sets</strong> here — tap <strong>+ New Crew Set</strong>, pick your members, and save. Update them anytime your regular crew changes.<br/><br/><strong>That\'s the tour!</strong> Click <strong>Done</strong> to get started. The "Take a tour" button in the sidebar brings this back anytime.',
      side: 'right', align: 'start',
    },
  },
]

export function ForemanTourButton() {
  const { setActivePage } = useApp()

  const startTour = async () => {
    const { driver } = await import('driver.js')

    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.22,
      stagePadding: 8,
      stageRadius: 8,
      progressText: 'Step {{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
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
