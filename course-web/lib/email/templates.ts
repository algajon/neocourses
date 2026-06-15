export interface RenderedTemplate {
  subject: string
  html: string
  text: string
}

function appUrl(): string {
  return process.env.NEXTAUTH_URL?.trim().replace(/\/$/, '') || 'http://localhost:3000'
}

function absolute(path?: string): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//i.test(path)) return path
  return `${appUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

const COLORS = {
  bg: '#0b0b0d',
  card: '#ffffff',
  text: '#1a1a1a',
  muted: '#666666',
  accentText: '#7a8b00',
  border: '#e5e5e5',
}

function wordmark(): string {
  return `<span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${COLORS.text};">course<span style="color:${COLORS.accentText};">neo</span></span>`
}

function button(label: string, href?: string): string {
  if (!href) return ''
  return `<a href="${href}" style="display:inline-block;background:${COLORS.text};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px;">${label}</a>`
}

/** Wraps body HTML in the shared branded shell. All styles inline for email clients. */
function shell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${COLORS.card};border-radius:14px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px 32px;">${wordmark()}</td></tr>
        <tr><td style="padding:8px 32px 32px 32px;color:${COLORS.text};font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid ${COLORS.border};color:${COLORS.muted};font-size:12px;line-height:1.5;">
          You're receiving this because you have a courseneo account. Visit <a href="${appUrl()}" style="color:${COLORS.muted};">courseneo</a> to manage your learning.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function p(text: string): string {
  return `<p style="margin:0 0 16px 0;">${text}</p>`
}

export interface WelcomeArgs {
  name?: string
  orgName?: string
}

export function welcome(args: WelcomeArgs): RenderedTemplate {
  const greeting = args.name ? `Hi ${args.name},` : 'Welcome,'
  const org = args.orgName ? ` to ${args.orgName} on courseneo` : ' to courseneo'
  const html = shell(
    p(greeting) +
      p(`Welcome${org}! Your account is ready. Jump in to explore courses assigned to you and track your progress.`) +
      `<div style="margin-top:8px;">${button('Open courseneo', appUrl())}</div>`
  )
  return {
    subject: 'Welcome to courseneo',
    html,
    text: `${greeting}\n\nWelcome${org}! Your account is ready. Open courseneo to get started: ${appUrl()}`,
  }
}

export interface CourseAssignedArgs {
  name?: string
  courseTitle: string
  link?: string
  dueAt?: Date | null
}

export function courseAssigned(args: CourseAssignedArgs): RenderedTemplate {
  const greeting = args.name ? `Hi ${args.name},` : 'Hello,'
  const href = absolute(args.link)
  const due = args.dueAt ? ` It's due by ${formatDate(args.dueAt)}.` : ''
  const html = shell(
    p(greeting) +
      p(`A new course has been assigned to you: <strong>${escapeHtml(args.courseTitle)}</strong>.${due}`) +
      `<div style="margin-top:8px;">${button('Start course', href)}</div>`
  )
  return {
    subject: `New course assigned: ${args.courseTitle}`,
    html,
    text: `${greeting}\n\nA new course has been assigned to you: ${args.courseTitle}.${due}${href ? `\n\nStart it here: ${href}` : ''}`,
  }
}

export interface CourseCompletedArgs {
  name?: string
  courseTitle: string
  link?: string
}

export function courseCompleted(args: CourseCompletedArgs): RenderedTemplate {
  const greeting = args.name ? `Congratulations ${args.name}!` : 'Congratulations!'
  const href = absolute(args.link)
  const html = shell(
    p(greeting) +
      p(`You've completed <strong>${escapeHtml(args.courseTitle)}</strong>. Great work seeing it through.`) +
      `<div style="margin-top:8px;">${button('View certificate', href)}</div>`
  )
  return {
    subject: `You completed ${args.courseTitle}`,
    html,
    text: `${greeting}\n\nYou've completed ${args.courseTitle}. Great work!${href ? `\n\nView your certificate: ${href}` : ''}`,
  }
}

export interface AssignmentReminderArgs {
  name?: string
  courseTitle: string
  link?: string
  dueAt?: Date | null
  overdue?: boolean
}

export function assignmentReminder(args: AssignmentReminderArgs): RenderedTemplate {
  const greeting = args.name ? `Hi ${args.name},` : 'Hello,'
  const href = absolute(args.link)
  const dueLine = args.dueAt
    ? args.overdue
      ? `This course was due on ${formatDate(args.dueAt)} and is now overdue.`
      : `This course is due by ${formatDate(args.dueAt)}.`
    : 'This course is still waiting for you.'
  const html = shell(
    p(greeting) +
      p(`A reminder about your assigned course: <strong>${escapeHtml(args.courseTitle)}</strong>.`) +
      p(dueLine) +
      `<div style="margin-top:8px;">${button('Continue course', href)}</div>`
  )
  return {
    subject: args.overdue
      ? `Overdue: ${args.courseTitle}`
      : `Reminder: ${args.courseTitle}`,
    html,
    text: `${greeting}\n\nA reminder about your assigned course: ${args.courseTitle}.\n${dueLine}${href ? `\n\nContinue here: ${href}` : ''}`,
  }
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
