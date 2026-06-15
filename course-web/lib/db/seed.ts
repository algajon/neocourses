import '@/lib/load-env'
import { db, pool } from '@/lib/db'
import {
  organizations,
  users,
  courses,
  modules,
  lessons,
  quizzes,
  quizQuestions,
  quizAttempts,
  enrollments,
  lessonProgress,
  onboardingChecklists,
  checklistItems,
  checklistProgress,
  aiTutorMessages,
} from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/utils'
import { v4 as uuidv4 } from 'uuid'

const now = new Date()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ts(offsetDays = 0): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - offsetDays)
  return d
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  // Schema is now managed by drizzle-kit. Run `npm run db:migrate` before seeding.
  console.log('Seeding (ensure `npm run db:migrate` has been run first)…')

  // -------------------------------------------------------------------------
  // 1. Organization
  // -------------------------------------------------------------------------
  console.log('Seeding organization…')
  await db
    .insert(organizations)
    .values({
      id: 'org-acme',
      name: 'Acme Corp',
      slug: 'acme-corp',
      createdAt: ts(60),
      updatedAt: ts(60),
    })
    .onConflictDoNothing()

  // -------------------------------------------------------------------------
  // 2. Users
  // -------------------------------------------------------------------------
  console.log('Seeding users…')

  const adminHash = await hashPassword('password123')
  const reviewerHash = await hashPassword('password123')
  const johnHash = await hashPassword('password123')
  const janeHash = await hashPassword('password123')

  const adminId = 'user-admin'
  const reviewerId = 'user-reviewer'
  const johnId = 'user-john'
  const janeId = 'user-jane'

  await db
    .insert(users)
    .values([
      {
        id: adminId,
        email: 'admin@acme.com',
        name: 'Alice Admin',
        passwordHash: adminHash,
        role: 'admin',
        organizationId: 'org-acme',
        createdAt: ts(60),
        updatedAt: ts(60),
      },
      {
        id: reviewerId,
        email: 'reviewer@acme.com',
        name: 'Bob Reviewer',
        passwordHash: reviewerHash,
        role: 'reviewer',
        organizationId: 'org-acme',
        createdAt: ts(55),
        updatedAt: ts(55),
      },
      {
        id: johnId,
        email: 'john@acme.com',
        name: 'John Smith',
        passwordHash: johnHash,
        role: 'learner',
        organizationId: 'org-acme',
        createdAt: ts(30),
        updatedAt: ts(2),
      },
      {
        id: janeId,
        email: 'jane@acme.com',
        name: 'Jane Doe',
        passwordHash: janeHash,
        role: 'learner',
        organizationId: 'org-acme',
        createdAt: ts(28),
        updatedAt: ts(5),
      },
    ])
    .onConflictDoNothing()

  console.log('  admin@acme.com, reviewer@acme.com, john@acme.com, jane@acme.com')

  // -------------------------------------------------------------------------
  // 3. Course
  // -------------------------------------------------------------------------
  console.log('Seeding course…')

  const courseId = 'course-onboarding'

  await db
    .insert(courses)
    .values({
      id: courseId,
      organizationId: 'org-acme',
      createdById: adminId,
      title: 'New Employee Onboarding',
      description:
        'A comprehensive onboarding program to help new employees get up to speed quickly, understand company culture, and become productive team members.',
      courseType: 'onboarding',
      difficultyLevel: 'beginner',
      estimatedMinutes: 180,
      certificateEnabled: true,
      status: 'published',
      publishedAt: ts(20),
      createdAt: ts(25),
      updatedAt: ts(20),
    })
    .onConflictDoNothing()

  // -------------------------------------------------------------------------
  // 4. Modules
  // -------------------------------------------------------------------------
  console.log('Seeding modules…')

  const moduleDefs = [
    { id: 'mod-welcome', title: 'Welcome to Acme Corp', position: 0 },
    { id: 'mod-policies', title: 'Company Policies & Guidelines', position: 1 },
    { id: 'mod-tools', title: 'Internal Tools & Systems', position: 2 },
    { id: 'mod-security', title: 'Security Fundamentals', position: 3 },
    { id: 'mod-workflow', title: 'Team Workflow & Collaboration', position: 4 },
  ]

  await db
    .insert(modules)
    .values(
      moduleDefs.map((m) => ({
        ...m,
        courseId,
        createdAt: ts(24),
        updatedAt: ts(24),
      }))
    )
    .onConflictDoNothing()

  // -------------------------------------------------------------------------
  // 5. Lessons
  // -------------------------------------------------------------------------
  console.log('Seeding lessons…')

  const lessonDefs: Array<{
    id: string
    moduleId: string
    title: string
    position: number
    content: object
  }> = [
    // --- Module 1: Welcome to Acme Corp ---
    {
      id: 'les-history',
      moduleId: 'mod-welcome',
      title: 'Company History & Mission',
      position: 0,
      content: {
        intro:
          'Acme Corp was founded in 1998 with a bold mission to make enterprise software accessible to everyone. Understanding our history helps you connect with the culture and values that drive everything we do.',
        concepts: [
          {
            title: 'Founding Story',
            body: 'Acme Corp was started in a garage by two engineers who believed software should be simple. From those humble beginnings we have grown to over 500 employees across 12 countries.',
          },
          {
            title: 'Core Mission',
            body: 'Our mission is to empower organizations through intuitive technology. Every product decision is measured against whether it moves us closer to that mission.',
          },
          {
            title: 'Values in Practice',
            body: 'Acme Corp operates on four values: transparency, craftsmanship, customer obsession, and continuous learning. These values are not posters on a wall — they show up in how we hire, promote, and make decisions.',
          },
          {
            title: 'Where We Are Headed',
            body: 'Our three-year roadmap focuses on AI-assisted workflows and global expansion into Southeast Asia. Your work directly contributes to these strategic goals.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'When you face a product decision, ask "Does this align with our mission?" — that question alone eliminates 80% of unnecessary debates.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'Acme Corp shipped its first product to a single customer in 1999, and that customer is still with us today.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Read the company all-hands recordings from the past two years — they give you the clearest view of how strategy has evolved.',
          },
        ],
        keyTakeaways: [
          'Acme Corp was founded in 1998 on a mission to make enterprise software accessible.',
          'Four core values guide all hiring, promotion, and decision-making.',
          'The three-year roadmap centers on AI workflows and Southeast Asia expansion.',
          'Our founding customer is still with us — relationships matter deeply here.',
        ],
        practicalExample:
          'A new product manager proposed a feature that would speed up onboarding but required collecting more user data than necessary. By anchoring the discussion to our "customer obsession" value, the team redesigned the feature to achieve the same result with a lighter data footprint.',
      },
    },
    {
      id: 'les-team',
      moduleId: 'mod-welcome',
      title: 'Meet Your Team',
      position: 1,
      content: {
        intro:
          'Getting to know the people around you is the single fastest way to become productive. This lesson walks you through how teams are structured and how to find the right person for any question.',
        concepts: [
          {
            title: 'Org Structure',
            body: 'Acme Corp is organized into five tribes: Product, Engineering, Design, Go-to-Market, and Operations. Each tribe has a Director who reports to the C-suite.',
          },
          {
            title: 'Your Immediate Team',
            body: 'Your squad is a cross-functional unit of 5–8 people focused on a single product area. Squads own their roadmap and ship independently.',
          },
          {
            title: 'Key Contacts',
            body: 'Every new employee is assigned an onboarding buddy — a peer who has been here at least six months. Your buddy is your first stop for any question that feels too small to escalate to your manager.',
          },
          {
            title: 'Communication Norms',
            body: 'Default to asynchronous communication via Slack for most things. Reserve synchronous meetings for decisions that require real-time collaboration.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'Schedule 15-minute "coffee chats" with five team members in your first two weeks — informal connections accelerate your integration more than any document.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'The buddy program was introduced in 2018 and reduced new-hire time-to-productivity by 35%.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Update your Slack profile with your role, timezone, and a short bio — it helps remote colleagues know immediately who you are.',
          },
        ],
        keyTakeaways: [
          'Five tribes make up the company: Product, Engineering, Design, GTM, and Operations.',
          'Squads are cross-functional units that own a product area end-to-end.',
          'Your onboarding buddy is your go-to for low-stakes questions.',
          'Default to async communication; use sync time for real decisions.',
        ],
        practicalExample:
          'A new engineer needed a security review for a feature but didn\'t know who to ask. By checking the org chart in Notion and pinging their onboarding buddy, they identified the right security champion within five minutes and unblocked their work.',
      },
    },
    {
      id: 'les-firstweek',
      moduleId: 'mod-welcome',
      title: 'Your First Week Checklist',
      position: 2,
      content: {
        intro:
          'Your first week sets the tone for your entire tenure. This lesson outlines the concrete tasks and milestones you should hit before your first Friday.',
        concepts: [
          {
            title: 'Day 1: Logistics',
            body: 'Complete IT setup, get your accounts provisioned, and attend the new-hire orientation session. Do not skip the orientation — it covers compliance items that must be acknowledged within 24 hours.',
          },
          {
            title: 'Day 2–3: Context Building',
            body: 'Read the product brief, explore the live product as a customer would, and shadow at least one customer call or support ticket resolution.',
          },
          {
            title: 'Day 4: Team Integration',
            body: 'Attend your squad\'s sprint standup, join the retrospective if one is scheduled, and make your first pull request or equivalent contribution in your domain.',
          },
          {
            title: 'Day 5: Reflection',
            body: 'Complete your onboarding checklist self-assessment and share three open questions with your manager during your end-of-week 1-on-1.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'Write down every question that comes up during your first week, even tiny ones. Reviewing them on Friday often reveals patterns about the most important things you still need to learn.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'Research shows that new hires who complete a structured first-week checklist are 58% more likely to still be at the company after three years.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Block your first Friday afternoon for personal reflection and checklist review — it is easy to let the week blur by without pausing.',
          },
        ],
        keyTakeaways: [
          'IT setup and compliance acknowledgement must happen on Day 1.',
          'Shadow a customer interaction by Day 3 to ground your context in reality.',
          'Make a real contribution to your team by Day 4.',
          'End-of-week 1-on-1 with your manager should surface open questions.',
        ],
        practicalExample:
          'A new designer skipped the Day 2 product exploration step and spent her first sprint solving a problem the product already addressed. After the first-week retrospective, the team added "use the product for 30 minutes as a customer" as a required checklist item.',
      },
    },

    // --- Module 2: Company Policies & Guidelines ---
    {
      id: 'les-conduct',
      moduleId: 'mod-policies',
      title: 'Code of Conduct',
      position: 0,
      content: {
        intro:
          'Acme Corp\'s Code of Conduct sets the behavioral expectations that allow a diverse, high-trust workplace to function. Every employee must read and digitally sign it within their first 48 hours.',
        concepts: [
          {
            title: 'Respect and Inclusion',
            body: 'All employees are expected to treat colleagues, customers, and partners with respect regardless of background. Harassment of any kind is grounds for immediate termination.',
          },
          {
            title: 'Conflict of Interest',
            body: 'You must disclose any personal relationship or financial interest that could influence a business decision. Undisclosed conflicts are a policy violation even if no harm results.',
          },
          {
            title: 'Confidentiality',
            body: 'Company data, customer information, and product roadmaps are confidential. Do not share them on public forums, with former employers, or with friends outside Acme Corp.',
          },
          {
            title: 'Reporting Violations',
            body: 'You can report suspected violations to your manager, HR, or the anonymous ethics hotline. Retaliation against reporters is itself a terminable offense.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'If you are ever unsure whether a specific action violates policy, ask HR proactively — it is never embarrassing to check, and it protects both you and the company.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'Acme Corp\'s anonymous ethics hotline receives an average of 12 reports per year, and every one is investigated within 10 business days.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Save the ethics hotline number in your phone now so it is accessible if you ever need it under stress.',
          },
        ],
        keyTakeaways: [
          'The Code of Conduct must be signed within 48 hours of starting.',
          'Harassment of any kind is a terminable offense.',
          'Conflicts of interest must be disclosed proactively.',
          'Retaliation against ethics reporters is itself a terminable offense.',
        ],
        practicalExample:
          'An employee discovered that a vendor they were evaluating was owned by their spouse. They disclosed this to their manager before the evaluation began, were recused from the decision, and the process proceeded fairly with no policy violation.',
      },
    },
    {
      id: 'les-timeoff',
      moduleId: 'mod-policies',
      title: 'Time Off & Benefits',
      position: 1,
      content: {
        intro:
          'Acme Corp offers a competitive benefits package designed to support your wellbeing inside and outside work. Understanding your entitlements helps you plan and prevents surprises.',
        concepts: [
          {
            title: 'Paid Time Off (PTO)',
            body: 'Full-time employees receive 20 days of PTO per year, accruing at 1.67 days per month. Unused PTO can be carried over up to 5 days into the next calendar year.',
          },
          {
            title: 'Sick Leave',
            body: 'You receive 10 sick days per year, separate from PTO. Sick days do not accrue or roll over — they reset each January 1.',
          },
          {
            title: 'Health & Dental',
            body: 'Acme Corp covers 100% of employee health and dental premiums. Dependents can be added at a 30% employee co-pay. Open enrollment is in November each year.',
          },
          {
            title: 'Additional Benefits',
            body: 'The company offers a $1,500 annual learning budget, a $500 home-office stipend for remote employees, and a 4% 401(k) match with immediate vesting.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'Book your PTO in the HR system at least two weeks in advance for planned absences — it helps your team plan coverage and avoids last-minute conflicts.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'Employees who use their full learning budget promote within 18 months at twice the rate of those who don\'t.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Use your learning budget before Q4 — requests spike in November and December and approvals slow down.',
          },
        ],
        keyTakeaways: [
          '20 days PTO per year, accruing monthly, with 5-day carry-over.',
          '10 sick days per year, separate from PTO, no roll-over.',
          'Company covers 100% of employee health and dental premiums.',
          '$1,500 learning budget and 4% 401(k) match are available from day one.',
        ],
        practicalExample:
          'A new developer wanted to attend a major conference six months into her role. She used $900 of her learning budget for registration and asked her manager two months in advance. The trip was approved and she returned with skills that directly accelerated her team\'s next sprint.',
      },
    },
    {
      id: 'les-remote',
      moduleId: 'mod-policies',
      title: 'Remote Work Policy',
      position: 2,
      content: {
        intro:
          'Acme Corp operates as a hybrid-first company. Most roles allow 3–5 days of remote work per week, provided you meet the connectivity and security requirements outlined here.',
        concepts: [
          {
            title: 'Eligibility',
            body: 'Remote work is available to all employees who have completed their first 30 days and whose roles do not require physical presence. Part of the onboarding process is confirming your eligibility with HR.',
          },
          {
            title: 'Connectivity Requirements',
            body: 'Remote employees must have a stable internet connection of at least 25 Mbps. Company data must never be accessed over public Wi-Fi without a VPN active.',
          },
          {
            title: 'Core Hours',
            body: 'All employees, regardless of location, are expected to be reachable between 10 AM and 3 PM in their team\'s primary timezone. Outside those hours, async work is encouraged.',
          },
          {
            title: 'Equipment & Security',
            body: 'Only company-issued or IT-approved devices may be used to access production systems. Personal devices are permitted for communication apps (Slack, email) only.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'Set your working hours in Slack and Google Calendar so teammates in other timezones know when you are available for synchronous work.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'Since adopting the hybrid-first policy in 2021, Acme Corp\'s employee satisfaction score has risen from 72% to 89%.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'If you work remotely, over-communicate your status updates — visibility gaps are the most common friction point in distributed teams.',
          },
        ],
        keyTakeaways: [
          'Remote work is available after 30 days for eligible roles.',
          'VPN is mandatory when accessing company data over any non-home network.',
          'Core hours 10 AM–3 PM in the team\'s primary timezone apply to all employees.',
          'Only company-issued or IT-approved devices may access production systems.',
        ],
        practicalExample:
          'A remote engineer connected to a hotel Wi-Fi without activating the VPN and then opened a production dashboard. IT\'s network monitoring flagged the access within seconds, and the engineer received a policy reminder. No data was compromised, but the incident reinforced the importance of the VPN requirement.',
      },
    },

    // --- Module 3: Internal Tools & Systems ---
    {
      id: 'les-comms',
      moduleId: 'mod-tools',
      title: 'Communication Tools (Slack & Email)',
      position: 0,
      content: {
        intro:
          'Clear communication is the backbone of a high-performing team. Acme Corp uses Slack for real-time collaboration and email for formal, external, or asynchronous communication.',
        concepts: [
          {
            title: 'Slack Channel Conventions',
            body: 'Channels are organized as #team-<squad>, #proj-<project>, and #general-<topic>. Post in the most specific channel available to keep noise low for everyone else.',
          },
          {
            title: 'Slack Etiquette',
            body: 'Use threads for extended discussions to keep channels readable. Tag people only when their input is truly needed — @here and @channel should be reserved for urgent, time-sensitive messages.',
          },
          {
            title: 'Email Usage',
            body: 'Email is for external stakeholders, formal approvals, HR communications, and anything that needs a persistent paper trail. Expect responses within one business day.',
          },
          {
            title: 'Meeting Hygiene',
            body: 'All meetings require a written agenda in the invite. Decisions made in meetings must be summarized in the relevant Slack channel or project doc within 24 hours.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'When you join a new project, ask the tech lead to add you to the right Slack channels and Notion space on Day 1 — searching for information across an unfamiliar workspace is a major time sink.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'Acme Corp sends an average of 48,000 Slack messages per day — a well-named channel can save the entire company hours of searching.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Configure Slack\'s "Do Not Disturb" schedule to match your non-working hours so notifications don\'t interrupt your evenings.',
          },
        ],
        keyTakeaways: [
          'Use the most specific Slack channel; threads keep channels readable.',
          '@here and @channel are for urgent, time-sensitive messages only.',
          'Email is for external parties, formal approvals, and paper-trail items.',
          'All meetings need a written agenda, and decisions must be documented after.',
        ],
        practicalExample:
          'A project manager sent an @channel message to 200 people in #general-engineering to ask who owned a specific repository. After receiving 40 replies, she learned to use #team-platform for infrastructure questions and @repo-owners for ownership lookups — reducing noise for the entire org.',
      },
    },
    {
      id: 'les-pm',
      moduleId: 'mod-tools',
      title: 'Project Management (Jira/Trello)',
      position: 1,
      content: {
        intro:
          'Acme Corp uses Jira for engineering and product work and Trello for lighter operational tasks. Understanding how to find, update, and create tickets is essential to contributing visibly to your team.',
        concepts: [
          {
            title: 'Jira Workflow',
            body: 'Every engineering task lives in Jira as a ticket with a status of Backlog, In Progress, In Review, or Done. Move your ticket to the correct status at the start of every workday.',
          },
          {
            title: 'Ticket Anatomy',
            body: 'A good Jira ticket has a clear title, an acceptance criteria section, a story-point estimate, and an assignee. Tickets without acceptance criteria cannot enter the sprint.',
          },
          {
            title: 'Sprint Cadence',
            body: 'Engineering squads run two-week sprints. Sprint planning happens on Monday morning, standup daily at 9:30 AM team time, and retrospective on the last Friday.',
          },
          {
            title: 'Trello for Operations',
            body: 'Non-engineering teams use Trello boards for campaign tracking, vendor onboarding, and office logistics. Each board has a README card explaining its column structure.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'Before starting any work, check if a Jira ticket already exists. Duplicate efforts without a ticket are invisible to the team and miss sprint credit.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'Teams that update their Jira tickets daily spend 40% less time in status meetings than teams that batch-update at the end of the sprint.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Add yourself as a watcher on tickets that affect your work even when you are not the assignee — you\'ll receive status updates automatically.',
          },
        ],
        keyTakeaways: [
          'Move Jira tickets to the correct status every morning.',
          'Tickets without acceptance criteria cannot enter the sprint.',
          'Sprints are two weeks; standup is daily at 9:30 AM team time.',
          'Trello is for operational tasks outside of engineering workflows.',
        ],
        practicalExample:
          'A new front-end developer started building a feature without a Jira ticket because it felt small. Halfway through, a backend engineer independently built the same feature. After the collision, the team adopted a "no ticket, no work" rule that prevented further duplication.',
      },
    },
    {
      id: 'les-hr-system',
      moduleId: 'mod-tools',
      title: 'HR System & Payroll',
      position: 2,
      content: {
        intro:
          'Acme Corp uses Workday as its HRIS for payroll, benefits enrollment, PTO requests, and performance reviews. Getting familiar with Workday in your first week saves you from administrative headaches later.',
        concepts: [
          {
            title: 'Payroll Schedule',
            body: 'Payroll is processed bi-weekly on Fridays. Direct deposit is the default; paper checks require an HR request and take an extra two business days.',
          },
          {
            title: 'PTO Requests',
            body: 'All time-off requests are submitted in Workday under "Absence." Requests under two days need manager approval only; requests over two consecutive days require HR notification as well.',
          },
          {
            title: 'Benefits Enrollment',
            body: 'Benefits enrollment is completed in Workday during your first 30 days. Changes are only permitted during open enrollment in November or after a qualifying life event.',
          },
          {
            title: 'Performance Reviews',
            body: 'Annual reviews are conducted in Workday every October. Mid-year check-ins are informal and documented in your 1-on-1 notes, not in the system.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'Complete your Workday profile — job title, department, manager — in the first 48 hours. Incomplete profiles block your payroll setup and delay benefits enrollment.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'Workday sends automated reminders for expiring benefits elections, but 20% of employees miss open enrollment and lose their coverage window annually.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Bookmark the Workday login URL — it is easy to forget since you don\'t use it every day, and resetting access can take several hours.',
          },
        ],
        keyTakeaways: [
          'Payroll is bi-weekly on Fridays via direct deposit.',
          'PTO requests are submitted in Workday; long absences require HR notification.',
          'Benefits enrollment must be completed within your first 30 days.',
          'Annual performance reviews occur every October in Workday.',
        ],
        practicalExample:
          'A new hire forgot to complete benefits enrollment during her first month. When open enrollment closed, she discovered she had defaulted to no dental coverage. She had to wait until a qualifying life event — her wedding six months later — to add the coverage she wanted.',
      },
    },

    // --- Module 4: Security Fundamentals ---
    {
      id: 'les-passwords',
      moduleId: 'mod-security',
      title: 'Password Security',
      position: 0,
      content: {
        intro:
          'Weak or reused passwords are the leading cause of corporate data breaches. Acme Corp requires strong, unique passwords and enforces multi-factor authentication on all company systems.',
        concepts: [
          {
            title: 'Password Requirements',
            body: 'All Acme Corp account passwords must be at least 16 characters, include uppercase, lowercase, numbers, and symbols, and must not be reused across systems.',
          },
          {
            title: 'Password Manager',
            body: 'You will be provisioned a 1Password team account on Day 1. All passwords must be stored there — writing passwords in notebooks, spreadsheets, or notes apps is a policy violation.',
          },
          {
            title: 'Multi-Factor Authentication',
            body: 'MFA is mandatory for all company accounts. Use the Okta Verify app for TOTP codes. Hardware keys (YubiKey) are required for privileged infrastructure access.',
          },
          {
            title: 'Phishing Awareness',
            body: 'Phishing emails are the most common initial attack vector. Never enter your credentials on a page you reached by clicking a link in an email — always navigate directly to the service.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'When IT sets up your accounts, change every provisioned password immediately using the 1Password generator — provisioned passwords are often shared across multiple new hires.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'The average corporate password is cracked in under 11 hours without MFA. With MFA and a 16-character password, the same attack takes over 3 million years.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Enable biometric unlock in 1Password so you use it frictionlessly — security tools you find inconvenient will be bypassed.',
          },
        ],
        keyTakeaways: [
          'Passwords must be at least 16 characters with mixed character types.',
          '1Password is the only approved password storage method.',
          'MFA via Okta Verify is mandatory on all company accounts.',
          'Never enter credentials from an email link — navigate directly to the service.',
        ],
        practicalExample:
          'An employee received a convincing email appearing to be from the IT helpdesk asking them to verify credentials via a link. Instead of clicking, they opened a new browser tab, navigated to the IT portal directly, and found no pending verification — the email was a phishing attempt caught by the company\'s simulated phishing programme.',
      },
    },
    {
      id: 'les-data',
      moduleId: 'mod-security',
      title: 'Data Handling & Privacy',
      position: 1,
      content: {
        intro:
          'Data is one of Acme Corp\'s most valuable assets and one of our greatest responsibilities. Every employee who touches customer or company data must understand how to handle it correctly.',
        concepts: [
          {
            title: 'Data Classification',
            body: 'Acme Corp classifies data as Public, Internal, Confidential, or Restricted. Most day-to-day work involves Internal data. Restricted data (customer PII, financial records) requires explicit authorization to access.',
          },
          {
            title: 'GDPR and CCPA',
            body: 'We operate under GDPR in Europe and CCPA in California. Customer data must only be used for the purposes disclosed in the privacy policy, and deletion requests must be honored within 30 days.',
          },
          {
            title: 'Data Minimization',
            body: 'Collect only the data you need for the task at hand. Storing unnecessary personal data increases our liability and violates privacy principles.',
          },
          {
            title: 'Data Disposal',
            body: 'When data is no longer needed, it must be deleted from all locations including local drives, email attachments, and personal cloud storage. Use the secure deletion procedure in the IT wiki.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'Before exporting any customer data for analysis, confirm the data classification and get explicit manager approval if it includes any Restricted fields.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'GDPR fines can reach 4% of a company\'s global annual revenue. For Acme Corp, that would exceed $8 million.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'When in doubt, anonymize or aggregate data before sharing — it is always safer and often just as useful for analysis.',
          },
        ],
        keyTakeaways: [
          'Data is classified as Public, Internal, Confidential, or Restricted.',
          'GDPR and CCPA govern how we collect and process customer data.',
          'Collect only the minimum data necessary for the task.',
          'Deleted data must be removed from all storage locations including personal devices.',
        ],
        practicalExample:
          'A data analyst exported a full customer table to run a churn analysis, including names, emails, and payment history. After a review, the security team required her to re-run the analysis on an anonymized extract, reducing the exposure of Restricted data to only the analysts who genuinely needed it.',
      },
    },
    {
      id: 'les-incidents',
      moduleId: 'mod-security',
      title: 'Security Incident Reporting',
      position: 2,
      content: {
        intro:
          'Speed of response is the most critical factor in containing a security incident. Every employee is a first responder — knowing how and when to report can mean the difference between a minor event and a major breach.',
        concepts: [
          {
            title: 'What Counts as an Incident',
            body: 'An incident is any event that could compromise the confidentiality, integrity, or availability of company data or systems. This includes a lost laptop, a suspicious email you clicked, or unusual account activity.',
          },
          {
            title: 'The Reporting Process',
            body: 'Report incidents immediately to security@acme.com and your direct manager. Do not wait until you are certain — report suspicions promptly and let the security team investigate.',
          },
          {
            title: 'Do Not Self-Investigate',
            body: 'If you suspect a breach, do not attempt to investigate it yourself or delete evidence. Notify the security team and follow their instructions exactly.',
          },
          {
            title: 'After an Incident',
            body: 'All incidents trigger a post-mortem within 5 business days. The goal is systemic improvement, not blame. Reporters are protected from retaliation.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'Save security@acme.com in your contacts now. In a stressful moment, having the address immediately available removes a barrier to fast reporting.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'The average time to detect a data breach is 197 days. Companies with strong employee reporting culture detect breaches in under 72 hours.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'When reporting, include the time you noticed the issue, the system involved, and what you were doing — those details are critical for the security team\'s investigation.',
          },
        ],
        keyTakeaways: [
          'Any event that could compromise data or systems is a reportable incident.',
          'Report immediately to security@acme.com and your manager — do not wait for certainty.',
          'Never self-investigate or delete evidence; follow security team instructions.',
          'Post-mortems focus on systemic improvement, not individual blame.',
        ],
        practicalExample:
          'An employee received a Slack DM from what appeared to be the CEO asking for gift card codes. Recognizing this as a social engineering attempt, he immediately forwarded the message to security@acme.com, which enabled the security team to identify and block the attacker\'s account within 15 minutes.',
      },
    },

    // --- Module 5: Team Workflow & Collaboration ---
    {
      id: 'les-agile',
      moduleId: 'mod-workflow',
      title: 'Agile Workflow Basics',
      position: 0,
      content: {
        intro:
          'Acme Corp uses agile methodology to deliver software iteratively and respond to changing priorities. Understanding the agile basics helps you contribute effectively from your very first sprint.',
        concepts: [
          {
            title: 'Sprints and Iterations',
            body: 'Work is organized into two-week sprints with a defined scope. At the end of each sprint, the team ships something real — even if small — to a test environment or customers.',
          },
          {
            title: 'User Stories',
            body: 'Requirements are written as user stories: "As a [user], I want [capability] so that [outcome]." Stories ensure we stay focused on user value, not just technical tasks.',
          },
          {
            title: 'Definition of Done',
            body: 'Every squad has a Definition of Done — the checklist a ticket must satisfy to move to Done. Typical items include passing tests, code review, documentation, and product manager sign-off.',
          },
          {
            title: 'Velocity and Capacity',
            body: 'Velocity is the average story points completed per sprint. It is used for forecasting, not performance management. Never inflate estimates to make velocity look higher.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'Ask your tech lead to walk you through the squad\'s Definition of Done before you start your first ticket — it will save you rework and build trust quickly.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'The Agile Manifesto was written in 2001 by 17 software developers in a ski lodge in Utah. Its four values still drive how the best software teams work today.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Underpromise on story points in your first two sprints — it is better to complete everything and add stretch work than to carry over tickets.',
          },
        ],
        keyTakeaways: [
          'Work is organized into two-week sprints that ship real, testable output.',
          'User stories keep the team focused on user value over technical tasks.',
          'The Definition of Done is the acceptance gate for every ticket.',
          'Velocity is a forecasting tool, not a performance metric.',
        ],
        practicalExample:
          'A new engineer estimated tickets aggressively in her first sprint trying to impress the team, then carried over three tickets into the next sprint. After the retrospective, she adopted conservative estimates, consistently finished her sprint scope, and became known as one of the team\'s most reliable contributors.',
      },
    },
    {
      id: 'les-meetings',
      moduleId: 'mod-workflow',
      title: 'Meeting Culture & Etiquette',
      position: 1,
      content: {
        intro:
          'Meetings are expensive — a one-hour meeting with 10 people costs the company 10 hours of focused work time. Acme Corp takes meeting hygiene seriously to protect everyone\'s deep-work time.',
        concepts: [
          {
            title: 'The Agenda Rule',
            body: 'Every meeting must have a written agenda in the invite. If you receive a meeting invitation with no agenda, it is acceptable — and encouraged — to ask for one before accepting.',
          },
          {
            title: 'Decision Meetings vs. Status Updates',
            body: 'Only schedule a synchronous meeting when you need to reach a real-time decision or resolve ambiguity that async tools cannot handle. Status updates should be async by default.',
          },
          {
            title: 'Being Present',
            body: 'If you attend a meeting, be fully present — no laptops for unrelated work, no phones. If the meeting is not valuable enough to deserve your full attention, decline or ask to be removed.',
          },
          {
            title: 'Action Items and Follow-Up',
            body: 'Every meeting ends with documented action items: owner, task, and due date. The meeting organizer posts the summary in Slack within 24 hours.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'If you are the meeting organizer, send the agenda at least 24 hours in advance and state whether the meeting is for decision-making, brainstorming, or information sharing — context changes how people prepare.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'The average knowledge worker attends 62 meetings per month and considers more than half of them unnecessary. Acme Corp\'s "No Meeting Wednesday" policy protects one full day of focus time each week.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'Block 15 minutes after each meeting on your calendar to write up your notes and action items while they are fresh.',
          },
        ],
        keyTakeaways: [
          'Every meeting must have a written agenda in the invite.',
          'Status updates should be async; sync time is for decisions and ambiguity resolution.',
          'Full presence in meetings is expected — no multitasking.',
          'Action items with owner, task, and due date must be posted within 24 hours.',
        ],
        practicalExample:
          'A product team was running a daily 30-minute sync that gradually became a status readout. After an audit, the team replaced it with a shared Notion doc updated each morning and reduced their meeting time to two 20-minute sessions per week, recovering 2.5 hours of focus time per person.',
      },
    },
    {
      id: 'les-feedback',
      moduleId: 'mod-workflow',
      title: 'Feedback & Performance Reviews',
      position: 2,
      content: {
        intro:
          'Continuous feedback is how high-performing teams grow. Acme Corp has a structured approach to feedback that makes it useful, specific, and safe for everyone involved.',
        concepts: [
          {
            title: 'The Feedback Framework',
            body: 'Acme Corp uses the SBI model: Situation, Behavior, Impact. Describe the specific situation, the observable behavior, and the impact it had — avoid generalizations and character judgments.',
          },
          {
            title: '1-on-1s',
            body: 'Weekly 1-on-1s with your manager are your primary feedback channel. Come prepared with updates, blockers, and questions. Your manager facilitates but you own the agenda.',
          },
          {
            title: 'Peer Reviews',
            body: 'Twice a year, you will participate in a 360-degree peer review process in Workday. Reviews are shared with the reviewee\'s manager, not publicly. Responses are expected within 5 business days.',
          },
          {
            title: 'Performance Improvement Plans',
            body: 'If performance is consistently below expectations, a formal PIP is created in collaboration with the employee, manager, and HR. PIPs are supportive tools, not punitive ones.',
          },
        ],
        callouts: [
          {
            type: 'practice',
            title: 'In Practice',
            text: 'Give feedback as soon as possible after the event — waiting weeks reduces specificity and makes the feedback feel disproportionate in the moment of delivery.',
          },
          {
            type: 'trivia',
            title: 'Did You Know?',
            text: 'Employees who receive weekly feedback are 43% more engaged than those who only receive it during annual reviews.',
          },
          {
            type: 'tip',
            title: 'Pro Tip',
            text: 'When asking for feedback, be specific: "What\'s one thing I could do differently in sprint planning?" generates far better insights than "Any feedback for me?"',
          },
        ],
        keyTakeaways: [
          'Use the SBI model: Situation, Behavior, Impact for all feedback.',
          'Weekly 1-on-1s are your primary feedback channel — come prepared.',
          'Twice-yearly 360 peer reviews are conducted in Workday.',
          'PIPs are collaborative, supportive tools — not punitive measures.',
        ],
        practicalExample:
          'A senior engineer noticed that a teammate consistently interrupted others during design reviews. Using the SBI model, he said: "In yesterday\'s design review [Situation], you spoke over Sarah three times when she was presenting [Behavior], which made her withdraw from the discussion and we lost her perspective [Impact]." The teammate accepted the feedback and immediately adjusted.',
      },
    },
  ]

  await db
    .insert(lessons)
    .values(
      lessonDefs.map((l) => ({
        id: l.id,
        moduleId: l.moduleId,
        courseId,
        title: l.title,
        contentJson: JSON.stringify(l.content),
        position: l.position,
        estimatedMinutes: 10,
        createdAt: ts(23),
        updatedAt: ts(23),
      }))
    )
    .onConflictDoNothing()

  console.log(`  Created ${lessonDefs.length} lessons`)

  // -------------------------------------------------------------------------
  // 6. Quizzes and questions
  // -------------------------------------------------------------------------
  console.log('Seeding quizzes…')

  const quizDefs = [
    {
      id: 'quiz-welcome',
      moduleId: 'mod-welcome',
      title: 'Welcome to Acme Corp — Knowledge Check',
      questions: [
        {
          id: 'qq-w1',
          questionText: 'In what year was Acme Corp founded?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) 1995', 'b) 1998', 'c) 2001', 'd) 2005']),
          correctAnswer: 'b',
          explanation: 'Acme Corp was founded in 1998 by two engineers who believed software should be simple.',
          position: 0,
        },
        {
          id: 'qq-w2',
          questionText: 'Which of the following is one of Acme Corp\'s four core values?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) Speed above all', 'b) Craftsmanship', 'c) Profit first', 'd) Hierarchy']),
          correctAnswer: 'b',
          explanation: 'The four core values are: transparency, craftsmanship, customer obsession, and continuous learning.',
          position: 1,
        },
        {
          id: 'qq-w3',
          questionText: 'Who is your primary go-to for low-stakes questions during onboarding?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) The CEO', 'b) HR department', 'c) Your onboarding buddy', 'd) The IT helpdesk']),
          correctAnswer: 'c',
          explanation: 'Every new employee is assigned an onboarding buddy — a peer who has been here at least six months and is your first stop for any small question.',
          position: 2,
        },
        {
          id: 'qq-w4',
          questionText: 'Acme Corp\'s buddy program reduced new-hire time-to-productivity by 35%.',
          questionType: 'true_false',
          options: null,
          correctAnswer: 'true',
          explanation: 'The buddy program was introduced in 2018 and has measurably improved new-hire integration speed.',
          position: 3,
        },
        {
          id: 'qq-w5',
          questionText: 'Describe the default communication preference at Acme Corp and explain when synchronous meetings are appropriate.',
          questionType: 'short_answer',
          options: null,
          correctAnswer: 'async_default_sync_for_decisions',
          explanation: 'Acme Corp defaults to asynchronous communication (Slack, docs) and reserves synchronous meetings for decisions requiring real-time collaboration.',
          position: 4,
        },
      ],
    },
    {
      id: 'quiz-policies',
      moduleId: 'mod-policies',
      title: 'Company Policies — Knowledge Check',
      questions: [
        {
          id: 'qq-p1',
          questionText: 'Within how many hours must new employees sign the Code of Conduct?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) 24 hours', 'b) 48 hours', 'c) 72 hours', 'd) 1 week']),
          correctAnswer: 'b',
          explanation: 'The Code of Conduct must be digitally signed within the first 48 hours of employment.',
          position: 0,
        },
        {
          id: 'qq-p2',
          questionText: 'How many days of PTO does a full-time employee receive per year?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) 10 days', 'b) 15 days', 'c) 20 days', 'd) 25 days']),
          correctAnswer: 'c',
          explanation: 'Full-time employees receive 20 days of PTO per year, accruing at 1.67 days per month.',
          position: 1,
        },
        {
          id: 'qq-p3',
          questionText: 'What is the minimum internet speed required for remote employees accessing company systems?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) 10 Mbps', 'b) 25 Mbps', 'c) 50 Mbps', 'd) 100 Mbps']),
          correctAnswer: 'b',
          explanation: 'Remote employees must have a stable internet connection of at least 25 Mbps.',
          position: 2,
        },
        {
          id: 'qq-p4',
          questionText: 'Unused PTO can be carried over up to 10 days into the next calendar year.',
          questionType: 'true_false',
          options: null,
          correctAnswer: 'false',
          explanation: 'Unused PTO can be carried over up to 5 days (not 10) into the next calendar year.',
          position: 3,
        },
        {
          id: 'qq-p5',
          questionText: 'What VPN requirement applies to remote employees when they are not on their home network?',
          questionType: 'short_answer',
          options: null,
          correctAnswer: 'vpn_required_public_wifi',
          explanation: 'Company data must never be accessed over public Wi-Fi without a VPN active.',
          position: 4,
        },
      ],
    },
    {
      id: 'quiz-tools',
      moduleId: 'mod-tools',
      title: 'Internal Tools — Knowledge Check',
      questions: [
        {
          id: 'qq-t1',
          questionText: 'Which tool does Acme Corp use for engineering project management?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) Trello', 'b) Asana', 'c) Jira', 'd) Monday.com']),
          correctAnswer: 'c',
          explanation: 'Acme Corp uses Jira for engineering and product work, and Trello for lighter operational tasks.',
          position: 0,
        },
        {
          id: 'qq-t2',
          questionText: 'How long is each engineering sprint at Acme Corp?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) One week', 'b) Two weeks', 'c) Three weeks', 'd) One month']),
          correctAnswer: 'b',
          explanation: 'Engineering squads run two-week sprints with planning on Monday and retrospective on the last Friday.',
          position: 1,
        },
        {
          id: 'qq-t3',
          questionText: 'When should you use @channel or @here in Slack?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) For any important message', 'b) Only for urgent, time-sensitive messages', 'c) For all project updates', 'd) When tagging more than 3 people']),
          correctAnswer: 'b',
          explanation: '@here and @channel should be reserved for urgent, time-sensitive messages only to avoid noise.',
          position: 2,
        },
        {
          id: 'qq-t4',
          questionText: 'Payroll at Acme Corp is processed weekly every Friday.',
          questionType: 'true_false',
          options: null,
          correctAnswer: 'false',
          explanation: 'Payroll is processed bi-weekly (every two weeks) on Fridays, not weekly.',
          position: 3,
        },
        {
          id: 'qq-t5',
          questionText: 'Explain the criteria that must be met before a Jira ticket can enter the sprint.',
          questionType: 'short_answer',
          options: null,
          correctAnswer: 'needs_acceptance_criteria',
          explanation: 'A ticket must have a clear title, acceptance criteria, story-point estimate, and an assignee before it can enter the sprint.',
          position: 4,
        },
      ],
    },
    {
      id: 'quiz-security',
      moduleId: 'mod-security',
      title: 'Security Fundamentals — Knowledge Check',
      questions: [
        {
          id: 'qq-s1',
          questionText: 'What is the minimum required password length for all Acme Corp accounts?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) 8 characters', 'b) 12 characters', 'c) 16 characters', 'd) 20 characters']),
          correctAnswer: 'c',
          explanation: 'All passwords must be at least 16 characters and include uppercase, lowercase, numbers, and symbols.',
          position: 0,
        },
        {
          id: 'qq-s2',
          questionText: 'Which app is required for MFA on company accounts?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) Google Authenticator', 'b) Authy', 'c) Okta Verify', 'd) Microsoft Authenticator']),
          correctAnswer: 'c',
          explanation: 'MFA is mandatory for all company accounts using the Okta Verify app for TOTP codes.',
          position: 1,
        },
        {
          id: 'qq-s3',
          questionText: 'What is the correct first step when you suspect a security incident?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) Investigate it yourself', 'b) Delete the suspicious files', 'c) Wait until you are certain before reporting', 'd) Immediately notify security@acme.com and your manager']),
          correctAnswer: 'd',
          explanation: 'Report immediately to security@acme.com and your manager. Do not wait for certainty or investigate yourself.',
          position: 2,
        },
        {
          id: 'qq-s4',
          questionText: 'It is acceptable to store company passwords in a personal spreadsheet as a backup.',
          questionType: 'true_false',
          options: null,
          correctAnswer: 'false',
          explanation: 'All passwords must be stored in the company-provisioned 1Password account. Spreadsheets and personal notes apps are a policy violation.',
          position: 3,
        },
        {
          id: 'qq-s5',
          questionText: 'What data classification requires explicit authorization to access at Acme Corp?',
          questionType: 'short_answer',
          options: null,
          correctAnswer: 'restricted',
          explanation: 'Restricted data (customer PII, financial records) requires explicit authorization to access.',
          position: 4,
        },
      ],
    },
    {
      id: 'quiz-workflow',
      moduleId: 'mod-workflow',
      title: 'Team Workflow — Knowledge Check',
      questions: [
        {
          id: 'qq-wf1',
          questionText: 'What feedback model does Acme Corp use for structured feedback conversations?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) STAR', 'b) SBI (Situation, Behavior, Impact)', 'c) GROW', 'd) SMART']),
          correctAnswer: 'b',
          explanation: 'Acme Corp uses the SBI model: Situation, Behavior, Impact for all feedback.',
          position: 0,
        },
        {
          id: 'qq-wf2',
          questionText: 'What is the primary purpose of tracking velocity in agile?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) To evaluate individual performance', 'b) To rank team members', 'c) For sprint forecasting', 'd) To determine salary increases']),
          correctAnswer: 'c',
          explanation: 'Velocity is a forecasting tool — it estimates how much work a team can complete per sprint. It is not a performance management metric.',
          position: 1,
        },
        {
          id: 'qq-wf3',
          questionText: 'How long after a meeting should the organizer post the summary with action items?',
          questionType: 'multiple_choice',
          options: JSON.stringify(['a) Immediately during the meeting', 'b) Within 24 hours', 'c) Within 48 hours', 'd) At the next team standup']),
          correctAnswer: 'b',
          explanation: 'The meeting organizer posts the summary with action items in Slack within 24 hours of the meeting.',
          position: 2,
        },
        {
          id: 'qq-wf4',
          questionText: 'Acme Corp holds 360-degree peer reviews twice per year.',
          questionType: 'true_false',
          options: null,
          correctAnswer: 'true',
          explanation: 'Twice a year, employees participate in a 360-degree peer review process in Workday.',
          position: 3,
        },
        {
          id: 'qq-wf5',
          questionText: 'What is the "Definition of Done" in an agile workflow and why does it matter?',
          questionType: 'short_answer',
          options: null,
          correctAnswer: 'checklist_acceptance_gate',
          explanation: 'The Definition of Done is the checklist a ticket must satisfy to move to Done status — typically passing tests, code review, documentation, and PM sign-off.',
          position: 4,
        },
      ],
    },
  ]

  for (const quizDef of quizDefs) {
    await db
      .insert(quizzes)
      .values({
        id: quizDef.id,
        moduleId: quizDef.moduleId,
        courseId,
        title: quizDef.title,
        passingScore: 0.7,
        createdAt: ts(22),
        updatedAt: ts(22),
      })
      .onConflictDoNothing()

    await db
      .insert(quizQuestions)
      .values(
        quizDef.questions.map((q) => ({
          ...q,
          quizId: quizDef.id,
          createdAt: ts(22),
        }))
      )
      .onConflictDoNothing()
  }

  console.log(`  Created ${quizDefs.length} quizzes with 5 questions each`)

  // -------------------------------------------------------------------------
  // 7. Onboarding checklist
  // -------------------------------------------------------------------------
  console.log('Seeding onboarding checklist…')

  const checklistId = 'checklist-onboarding'

  await db
    .insert(onboardingChecklists)
    .values({
      id: checklistId,
      courseId,
      title: 'New Employee Onboarding Checklist',
      description: 'Complete all required items before your 30-day mark.',
      createdAt: ts(22),
      updatedAt: ts(22),
    })
    .onConflictDoNothing()

  const checklistItemTexts = [
    'Complete your IT setup and login to all systems',
    'Read and sign the Employee Handbook',
    'Schedule a 1:1 with your direct manager',
    'Join all required Slack channels',
    'Set up your email signature',
    'Complete mandatory security training',
    'Review the company org chart',
    'Add your photo to the company directory',
    'Set up your development environment (if applicable)',
    'Complete payroll and tax document setup',
    'Schedule intro calls with key team members',
    'Review the product/service demo',
    'Attend your first team standup',
    'Complete your 30-day check-in with HR',
    'Set your first 90-day goals with your manager',
  ]

  const checklistItemIds = checklistItemTexts.map((_, i) => `ci-${String(i + 1).padStart(2, '0')}`)

  await db
    .insert(checklistItems)
    .values(
      checklistItemTexts.map((text, i) => ({
        id: checklistItemIds[i],
        checklistId,
        text,
        isRequired: i < 6,
        position: i,
        createdAt: ts(22),
      }))
    )
    .onConflictDoNothing()

  console.log(`  Created ${checklistItemTexts.length} checklist items`)

  // -------------------------------------------------------------------------
  // 8. Enrollments
  // -------------------------------------------------------------------------
  console.log('Seeding enrollments…')

  const johnEnrollmentId = 'enroll-john'
  const janeEnrollmentId = 'enroll-jane'

  await db
    .insert(enrollments)
    .values([
      {
        id: johnEnrollmentId,
        userId: johnId,
        courseId,
        enrolledAt: ts(25),
        progressPercent: 60,
        lastAccessedAt: ts(1),
        status: 'active',
      },
      {
        id: janeEnrollmentId,
        userId: janeId,
        courseId,
        enrolledAt: ts(20),
        progressPercent: 30,
        lastAccessedAt: ts(3),
        status: 'active',
      },
    ])
    .onConflictDoNothing()

  // -------------------------------------------------------------------------
  // 9. LessonProgress
  // -------------------------------------------------------------------------
  console.log('Seeding lesson progress…')

  // John: first 9 lessons (all of modules 1, 2, and 3)
  const johnLessons = [
    'les-history', 'les-team', 'les-firstweek',
    'les-conduct', 'les-timeoff', 'les-remote',
    'les-comms', 'les-pm', 'les-hr-system',
  ]

  // Jane: first 4 lessons
  const janeLessons = ['les-history', 'les-team', 'les-firstweek', 'les-conduct']

  await db
    .insert(lessonProgress)
    .values([
      ...johnLessons.map((lessonId, i) => ({
        id: `lp-john-${lessonId}`,
        enrollmentId: johnEnrollmentId,
        userId: johnId,
        lessonId,
        courseId,
        completedAt: ts(20 - i),
        timeSpentSeconds: 480 + i * 60,
      })),
      ...janeLessons.map((lessonId, i) => ({
        id: `lp-jane-${lessonId}`,
        enrollmentId: janeEnrollmentId,
        userId: janeId,
        lessonId,
        courseId,
        completedAt: ts(15 - i),
        timeSpentSeconds: 420 + i * 45,
      })),
    ])
    .onConflictDoNothing()

  console.log(`  John: ${johnLessons.length} lessons, Jane: ${janeLessons.length} lessons`)

  // -------------------------------------------------------------------------
  // 10. QuizAttempts
  // -------------------------------------------------------------------------
  console.log('Seeding quiz attempts…')

  await db
    .insert(quizAttempts)
    .values([
      {
        id: 'qa-john-welcome',
        quizId: 'quiz-welcome',
        userId: johnId,
        enrollmentId: johnEnrollmentId,
        answers: JSON.stringify({ 'qq-w1': 'b', 'qq-w2': 'b', 'qq-w3': 'c', 'qq-w4': 'true', 'qq-w5': 'Async by default, sync for decisions' }),
        score: 0.85,
        passed: true,
        startedAt: ts(18),
        completedAt: ts(18),
      },
      {
        id: 'qa-john-policies',
        quizId: 'quiz-policies',
        userId: johnId,
        enrollmentId: johnEnrollmentId,
        answers: JSON.stringify({ 'qq-p1': 'b', 'qq-p2': 'c', 'qq-p3': 'b', 'qq-p4': 'false', 'qq-p5': 'VPN required on public Wi-Fi' }),
        score: 0.9,
        passed: true,
        startedAt: ts(14),
        completedAt: ts(14),
      },
      {
        id: 'qa-john-tools-fail',
        quizId: 'quiz-tools',
        userId: johnId,
        enrollmentId: johnEnrollmentId,
        answers: JSON.stringify({ 'qq-t1': 'a', 'qq-t2': 'b', 'qq-t3': 'b', 'qq-t4': 'true', 'qq-t5': 'Need good title' }),
        score: 0.6,
        passed: false,
        startedAt: ts(5),
        completedAt: ts(5),
      },
      {
        id: 'qa-jane-welcome',
        quizId: 'quiz-welcome',
        userId: janeId,
        enrollmentId: janeEnrollmentId,
        answers: JSON.stringify({ 'qq-w1': 'b', 'qq-w2': 'b', 'qq-w3': 'b', 'qq-w4': 'true', 'qq-w5': 'Default to async communication' }),
        score: 0.78,
        passed: true,
        startedAt: ts(10),
        completedAt: ts(10),
      },
    ])
    .onConflictDoNothing()

  console.log('  John: passed welcome (85%), passed policies (90%), failed tools (60%)')
  console.log('  Jane: passed welcome (78%)')

  // -------------------------------------------------------------------------
  // 11. ChecklistProgress
  // -------------------------------------------------------------------------
  console.log('Seeding checklist progress…')

  await db
    .insert(checklistProgress)
    .values([
      // John: first 8 items
      ...checklistItemIds.slice(0, 8).map((itemId, i) => ({
        id: `cp-john-${itemId}`,
        checklistItemId: itemId,
        userId: johnId,
        enrollmentId: johnEnrollmentId,
        completedAt: ts(20 - i * 2),
      })),
      // Jane: first 3 items
      ...checklistItemIds.slice(0, 3).map((itemId, i) => ({
        id: `cp-jane-${itemId}`,
        checklistItemId: itemId,
        userId: janeId,
        enrollmentId: janeEnrollmentId,
        completedAt: ts(15 - i * 2),
      })),
    ])
    .onConflictDoNothing()

  console.log('  John: 8 items complete, Jane: 3 items complete')

  // -------------------------------------------------------------------------
  // 12. AI Tutor Messages
  // -------------------------------------------------------------------------
  console.log('Seeding AI tutor messages…')

  await db
    .insert(aiTutorMessages)
    .values([
      {
        id: 'msg-john-q1',
        courseId,
        userId: johnId,
        lessonId: 'les-conduct',
        role: 'user',
        content: 'What should I do if I witness a colleague violating the code of conduct but I\'m not sure if what I saw is serious enough to report?',
        createdAt: ts(12),
      },
      {
        id: 'msg-john-a1',
        courseId,
        userId: johnId,
        lessonId: 'les-conduct',
        role: 'assistant',
        content: 'Great question! The guiding principle at Acme Corp is: when in doubt, report. You are not responsible for determining whether something is a violation — that is the security team\'s job. By reporting, you give the team the opportunity to investigate. You can use the anonymous ethics hotline if you are uncomfortable disclosing your identity. The policy explicitly protects reporters from retaliation, so you will not face consequences for a good-faith report that turns out to be a misunderstanding.',
        createdAt: ts(12),
      },
      {
        id: 'msg-john-q2',
        courseId,
        userId: johnId,
        lessonId: 'les-timeoff',
        role: 'user',
        content: 'If I join in March, how many PTO days will I have accrued by the end of the year?',
        createdAt: ts(8),
      },
      {
        id: 'msg-john-a2',
        courseId,
        userId: johnId,
        lessonId: 'les-timeoff',
        role: 'assistant',
        content: 'PTO accrues at 1.67 days per month. If you start in March, you will complete 10 months of the calendar year (March through December), giving you 10 × 1.67 = 16.7 days, which rounds to 16 days. You can carry over up to 5 unused days into January, so if you don\'t use any PTO in your first year you would start the next year with 5 banked days.',
        createdAt: ts(8),
      },
    ])
    .onConflictDoNothing()

  console.log('  Created 2 AI tutor exchanges for John')

  console.log('\nSeed complete.')
  console.log('Demo accounts:')
  console.log('  admin@acme.com    / password123  (admin)')
  console.log('  reviewer@acme.com / password123  (reviewer)')
  console.log('  john@acme.com     / password123  (learner, 60% complete)')
  console.log('  jane@acme.com     / password123  (learner, 30% complete)')
}

seed()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Seed failed:', err)
    await pool.end()
    process.exit(1)
  })
