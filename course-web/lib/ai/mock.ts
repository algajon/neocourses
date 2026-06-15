import type { AIProvider, CourseOutline, FullLessonContent, QuizQuestion, ChecklistItem } from './types'

function delay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class MockAIProvider implements AIProvider {
  async generateCourseOutline(title: string, _description: string, _materials: string): Promise<CourseOutline> {
    await delay(300, 800)

    if (title.toLowerCase().includes('onboard')) {
      return {
        modules: [
          {
            title: 'Welcome to the Company',
            description: 'Get acquainted with the company culture, mission, and values.',
            lessons: [
              { title: 'Company History & Mission', summary: 'Learn about how the company was founded and what drives us forward.' },
              { title: 'Culture & Core Values', summary: 'Understand the principles that guide everyday decisions and interactions.' },
              { title: 'Organizational Structure', summary: 'Meet the teams, departments, and key stakeholders across the organization.' },
            ],
          },
          {
            title: 'Company Policies & Guidelines',
            description: 'Essential policies every employee needs to know from day one.',
            lessons: [
              { title: 'Code of Conduct', summary: 'Behavioral expectations and professional standards in the workplace.' },
              { title: 'Leave & Benefits Overview', summary: 'PTO, health benefits, and other employee perks explained.' },
              { title: 'Performance Review Process', summary: 'How feedback cycles work and how your growth is supported.' },
            ],
          },
          {
            title: 'Internal Tools & Systems',
            description: 'Master the software and systems you will use every day.',
            lessons: [
              { title: 'Communication Tools', summary: 'Slack, email etiquette, and how to stay connected with your team.' },
              { title: 'Project Management Systems', summary: 'Using Jira, Asana, or equivalent tools to track your work.' },
              { title: 'HR & Payroll Portals', summary: 'Navigating the employee portal for pay stubs, time tracking, and requests.' },
            ],
          },
          {
            title: 'Security Fundamentals',
            description: 'Keep company data and systems safe from day one.',
            lessons: [
              { title: 'Password & Access Management', summary: 'Setting up strong passwords and using the company password manager.' },
              { title: 'Data Privacy Basics', summary: 'How to handle sensitive customer and company data responsibly.' },
              { title: 'Phishing & Social Engineering', summary: 'Recognizing and reporting suspicious messages and requests.' },
            ],
          },
          {
            title: 'Team Workflow & Collaboration',
            description: 'Work effectively with your team from your very first week.',
            lessons: [
              { title: 'Meeting Culture & Cadence', summary: 'How stand-ups, retrospectives, and planning sessions run here.' },
              { title: 'Documentation Standards', summary: 'Where to find and how to contribute to internal knowledge bases.' },
              { title: 'Cross-Team Collaboration', summary: 'Best practices for working with other departments and stakeholders.' },
            ],
          },
        ],
      }
    }

    return {
      modules: [
        {
          title: 'Foundations & Core Concepts',
          description: 'Start with the essential ideas and practical mental models that make the rest of the course easy to understand.',
          lessons: [
            { title: 'Introduction & Overview', summary: 'An outcome-focused look at what the course will teach you and why it matters in real work.' },
            { title: 'Key Terminology', summary: 'Essential vocabulary and definitions that keep the rest of the course clear and actionable.' },
            { title: 'Core Principles', summary: 'The central ideas that support everything else you will learn in this training.' },
          ],
        },
        {
          title: 'Practical Application',
          description: 'Move from concepts to concrete examples, guided walkthroughs, and real-world practice.',
          lessons: [
            { title: 'Common Use Cases', summary: 'A tour of the situations where these skills make the biggest difference.' },
            { title: 'Step-by-Step Walkthroughs', summary: 'Guided examples that show how to apply what you have learned in the wild.' },
            { title: 'Hands-On Exercises', summary: 'Practice scenarios designed to help you build confidence and retain the material.' },
          ],
        },
        {
          title: 'Advanced Techniques',
          description: 'Explore the higher-leverage patterns and smarter approaches that set experts apart.',
          lessons: [
            { title: 'Edge Cases & Problem Solving', summary: 'How to recognize and handle uncommon situations with confidence.' },
            { title: 'Best Practices & Standards', summary: 'Proven methods and norms that help you work more consistently and effectively.' },
            { title: 'Optimization Strategies', summary: 'Ways to deliver better results with less friction and fewer mistakes.' },
          ],
        },
        {
          title: 'Assessment & Certification',
          description: 'Review your progress, prepare for the final evaluation, and plan what comes next.',
          lessons: [
            { title: 'Review & Synthesis', summary: 'Bring together everything you have learned into a cohesive whole.' },
            { title: 'Practical Assessment Prep', summary: 'Tips and strategies to help you perform your best on the final assessment.' },
            { title: 'Next Steps & Resources', summary: 'A roadmap for keeping the momentum after completing this course.' },
          ],
        },
      ],
    }
  }

  async generateLessons(moduleTitle: string, lessonTitles: string[], _courseTitle: string): Promise<FullLessonContent[]> {
    await delay(400, 700)

    const introTemplates = [
      (lessonTitle: string) => `This lesson takes you inside ${lessonTitle}, showing why it matters for ${moduleTitle} and how you can use it to solve real problems from day one.`,
      (lessonTitle: string) => `In this lesson, you will uncover the most important ideas behind ${lessonTitle} and learn how they fit into the broader ${moduleTitle} story.`,
      (lessonTitle: string) => `Think of this lesson as a practical introduction to ${lessonTitle}: it explains the concept clearly, connects it to your goals, and prepares you to act on it.`,
      (lessonTitle: string) => `This lesson brings ${lessonTitle} to life with a focused, outcome-oriented explanation that makes the ideas behind ${moduleTitle} easy to apply.`,
    ]

    const chooseIntro = (lessonTitle: string) => {
      let hash = 0
      for (let i = 0; i < lessonTitle.length; i++) {
        hash = lessonTitle.charCodeAt(i) + ((hash << 5) - hash)
      }
      return introTemplates[Math.abs(hash) % introTemplates.length](lessonTitle)
    }

    return lessonTitles.map(title => ({
      title,
      content: {
        intro: chooseIntro(`${title}|${moduleTitle}`),
        concepts: [
          {
            title: 'Foundational Understanding',
            body: `${title} builds on a set of core principles that have been validated across many contexts. Understanding these foundations helps you make better decisions when applying the concepts in real scenarios.`,
          },
          {
            title: 'Key Components',
            body: `There are several important components that make up ${title}. Each one plays a distinct role, and together they form a cohesive framework for tackling related challenges.`,
          },
          {
            title: 'Common Patterns',
            body: `Practitioners regularly encounter recurring patterns when working with ${title}. Recognizing these patterns early allows you to respond more quickly and consistently.`,
          },
          {
            title: 'Practical Considerations',
            body: `Applying ${title} effectively requires awareness of context, constraints, and trade-offs. Real-world application often involves adapting standard approaches to fit your specific situation.`,
          },
        ],
        callouts: [
          {
            type: 'practice' as const,
            title: 'Try It Out',
            text: `Take a moment to think of a recent situation where ${title} would have been applicable. How could you have used the concepts covered here to improve the outcome?`,
          },
          {
            type: 'trivia' as const,
            title: 'Did You Know?',
            text: `The principles behind ${title} were first formalized in the early 2000s, but the underlying ideas have been used informally by practitioners for decades.`,
          },
          {
            type: 'tip' as const,
            title: 'Pro Tip',
            text: `When first applying ${title}, start with simple, low-stakes situations to build confidence. Gradually move to more complex scenarios as your familiarity grows.`,
          },
        ],
        keyTakeaways: [
          `${title} is grounded in a set of well-tested principles that apply across many contexts.`,
          `Breaking down the key components helps you understand how each part contributes to the whole.`,
          `Recognizing common patterns accelerates your ability to respond effectively.`,
          `Contextual awareness is critical when adapting these concepts to real-world situations.`,
        ],
        practicalExample: `Imagine a team lead at a mid-sized company using ${title} to improve their department's quarterly review process. By applying the structured approach covered in this lesson, they reduced meeting time by 30% while increasing team satisfaction scores significantly.`,
      },
      learningObjectives: [
        `Explain the core principles underlying ${title}.`,
        `Identify the key components and their roles within the overall framework.`,
        `Apply the concepts from ${title} to a real-world scenario in ${moduleTitle}.`,
      ],
      keyPoints: [
        `${title} is rooted in established principles with broad applicability.`,
        `The framework consists of distinct but interrelated components.`,
        `Context determines how and when to apply specific techniques.`,
        `Common patterns can be recognized and responded to systematically.`,
        `Continuous practice is the most effective path to mastery.`,
      ],
      summary: `This lesson covered the essential aspects of ${title} as they relate to ${moduleTitle}. You explored the foundational concepts, key components, and practical patterns that define this area. With this knowledge, you are well-equipped to recognize and apply these ideas in your day-to-day work.`,
    }))
  }

  async generateQuizQuestions(moduleTitle: string, _chapterContent: string, _courseTitle?: string): Promise<QuizQuestion[]> {
    await delay(300, 600)

    return [
      {
        questionText: `Which of the following best describes the primary purpose of ${moduleTitle}?`,
        questionType: 'multiple_choice' as const,
        options: [
          { id: 'a', text: 'To introduce foundational concepts and build a shared vocabulary.' },
          { id: 'b', text: 'To replace existing workflows with entirely new ones.' },
          { id: 'c', text: 'To evaluate team performance against external benchmarks.' },
          { id: 'd', text: 'To automate routine administrative tasks.' },
        ],
        correctAnswer: 'a',
        explanation: `${moduleTitle} focuses primarily on establishing a strong foundation. The goal is to build understanding that can be applied practically, not to displace existing systems outright.`,
      },
      {
        questionText: `When applying the concepts from ${moduleTitle}, what is the most important initial step?`,
        questionType: 'multiple_choice' as const,
        options: [
          { id: 'a', text: 'Immediately implement all recommendations at scale.' },
          { id: 'b', text: 'Understand the context and constraints of your specific situation.' },
          { id: 'c', text: 'Find the most complex example and start there.' },
          { id: 'd', text: 'Delegate the task to a subject-matter expert.' },
        ],
        correctAnswer: 'b',
        explanation: `Context is everything. Before applying any framework, it is critical to assess the specific environment, constraints, and goals that will shape how the concepts should be adapted.`,
      },
      {
        questionText: `Recognizing common patterns in ${moduleTitle} helps practitioners respond more quickly and consistently.`,
        questionType: 'true_false' as const,
        options: [
          { id: 'true', text: 'True' },
          { id: 'false', text: 'False' },
        ],
        correctAnswer: 'true',
        explanation: `Pattern recognition is a core skill in this domain. When you can identify a familiar pattern, you can apply a tested response rather than starting from scratch each time.`,
      },
      {
        questionText: `Which scenario best illustrates a practical application of ${moduleTitle}?`,
        questionType: 'multiple_choice' as const,
        options: [
          { id: 'a', text: 'A manager ignoring established guidelines to save time.' },
          { id: 'b', text: 'A team adapting a structured approach to reduce inefficiencies in their review cycle.' },
          { id: 'c', text: 'An individual memorizing terminology without applying it.' },
          { id: 'd', text: 'A department using a competing framework without any modification.' },
        ],
        correctAnswer: 'b',
        explanation: `Practical application means taking structured approaches and thoughtfully adapting them to improve real outcomes — not blindly following rules or ignoring them entirely.`,
      },
      {
        questionText: `In your own words, describe one way you would apply a concept from ${moduleTitle} in your current role.`,
        questionType: 'short_answer' as const,
        correctAnswer: 'open',
        explanation: `There is no single correct answer. A strong response connects a specific concept from the module to a concrete situation in the learner's role and explains the expected benefit.`,
      },
    ]
  }

  async generateChecklist(_courseTitle: string, _materials: string): Promise<ChecklistItem[]> {
    await delay(300, 600)

    return [
      { text: 'Meet with your direct manager', description: 'Schedule a 30-minute intro meeting to discuss your role, expectations, and first-week priorities.', isRequired: true },
      { text: 'Set up your company email', description: 'Configure your email client, set a professional signature, and verify access to all necessary inboxes.', isRequired: true },
      { text: 'Complete IT system setup', description: 'Install required software, configure VPN access, and submit any outstanding hardware requests to IT.', isRequired: true },
      { text: 'Review the employee handbook', description: 'Read through all sections of the handbook and acknowledge receipt in the HR portal.', isRequired: true },
      { text: 'Set up payroll and direct deposit', description: 'Log in to the payroll portal and enter your banking information to ensure your first paycheck is processed on time.', isRequired: true },
      { text: 'Shadow a colleague for a day', description: 'Spend time with an experienced team member to observe workflows, ask questions, and understand day-to-day operations.', isRequired: false },
      { text: 'Join relevant Slack channels', description: 'Subscribe to team channels, company-wide announcements, and any project-specific workspaces relevant to your role.', isRequired: true },
      { text: 'Attend your first team stand-up', description: 'Participate in the daily or weekly team meeting and introduce yourself to the group.', isRequired: false },
      { text: 'Complete mandatory compliance training', description: 'Finish all assigned compliance and legal training modules before the end of your first two weeks.', isRequired: true },
      { text: 'Set up your development environment', description: 'Clone relevant repositories, configure local tools, and verify you can run the project stack end-to-end.', isRequired: false },
      { text: 'Schedule 1:1 meetings with key collaborators', description: 'Book 20-minute intro calls with five to ten colleagues you will work with regularly.', isRequired: false },
      { text: 'Complete your first performance goal entry', description: 'Log in to the performance management system and set at least three goals for your first 90 days.', isRequired: true },
    ]
  }

  async answerTutorQuestion(courseContext: string, lessonContent: string, question: string): Promise<string> {
    await delay(400, 750)

    return `Great question! Based on what we covered in this lesson, ${question.toLowerCase().endsWith('?') ? question.slice(0, -1) : question} is something that comes up frequently in practice.

The core idea here ties back to what you read in the lesson content: the principles are designed to give you a repeatable framework rather than a rigid script. When you encounter a situation like this, start by identifying which pattern applies, then adapt the recommended approach to fit your specific context. The most common mistake is applying a method too rigidly without accounting for the variables in front of you.

A practical way to think about it: imagine you are in a real scenario right now. What information do you have? What constraints are you working with? What outcome are you trying to achieve? Answering those three questions first will almost always point you toward the right approach. If you want to explore this further, revisit the "Practical Considerations" concept card in this lesson — it walks through exactly this kind of decision-making process.`
  }
}
