export type LessonContent = {
  intro: string;
  concepts: { title: string; body: string }[];
  keyPoints?: string[];
  example?: string;
  tip: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

// Strip question words, "?" and action phrases so lesson titles read naturally in prose.
// "What is SQL?" → "SQL"   "How to Write SELECT Statements" → "SELECT Statements"
export function cleanForProse(s: string): string {
  let c = s.replace(/\?$/, '').trim();
  c = c.replace(/^(what (is|are|does)|how (to |does |do )|why (is |does |are )|when (to |is )|understanding |introduction to |overview of |working with |getting started with |deep dive into |exploring )/i, '');
  c = c.replace(/^(write|use|using|apply|create|build|manage|handle|implement|configure|set up|design|learn|master)\s+/i, '');
  return c.trim() || s.replace(/\?$/, '').trim();
}

function makeQ(
  id: string,
  question: string,
  correct: string,
  distractors: [string, string, string],
  seed: number
): QuizQuestion {
  const pos = seed % 4;
  const opts = [...distractors];
  opts.splice(pos, 0, correct);
  return { id, question, options: opts, correctIndex: pos };
}

export function generateLessonContent(lessonTitle: string, courseTopic: string): LessonContent {
  const h = hash(lessonTitle);
  const t = cleanForProse(lessonTitle);   // prose-safe version of the title
  const ctx = cleanForProse(courseTopic); // prose-safe version of the course/chapter topic

  const intros = [
    `${t} is one of the foundational skills in ${ctx}. Practitioners who invest time here move faster and make fewer costly mistakes later in the course.`,
    `This lesson covers ${t} and its role in the broader ${ctx} workflow. By the end you will have both a clear vocabulary and a mental model you can apply straight away.`,
    `${t} turns up constantly once you start working seriously with ${ctx}. This lesson builds the conceptual grounding so the practical side stops feeling like guesswork.`,
    `Every strong ${ctx} practitioner has a clear grasp of ${t}. This lesson focuses on what actually matters day-to-day rather than exhaustive theory.`,
  ];

  const conceptSets: { title: string; body: string }[][] = [
    [
      { title: 'Core mechanics', body: `${t} works by applying a consistent set of rules to a well-defined input. Once you understand those rules precisely, you can predict the output in any situation without needing to memorise every case.` },
      { title: 'Practical application', body: `Using ${t} well means choosing the right form for the job at hand. The most common form handles the majority of real-world needs; the variants exist for edge cases you will encounter as you progress.` },
      { title: 'Common mistakes to avoid', body: `Most errors with ${t} come from applying it in the wrong context or missing a small but significant constraint. Being aware of these pitfalls upfront means you avoid the most frequently seen stumbling blocks in real ${ctx} work.` },
    ],
    [
      { title: 'Why it exists', body: `${t} was designed to solve a specific, recurring problem in ${ctx}. Understanding that original problem makes the design decisions obvious, which in turn makes the concept much easier to remember and use correctly.` },
      { title: 'Key terms and syntax', body: `Precise terminology around ${t} matters because documentation, error messages, and colleagues all use these terms. Getting comfortable with the vocabulary now pays dividends every time you search for help or review someone else's work.` },
      { title: 'Recognisable patterns', body: `Once you have worked with ${t} a few times, certain structural patterns start to appear. Spotting them early is how experienced ${ctx} practitioners move quickly through unfamiliar material.` },
    ],
    [
      { title: 'Building the right mental model', body: `A good mental model for ${t} lets you reason from first principles rather than relying on memory. When something unexpected happens, the mental model is what helps you diagnose the cause and correct it confidently.` },
      { title: 'Connections to earlier concepts', body: `${t} builds directly on concepts you have already encountered in ${ctx}. Seeing those connections now, rather than later, reinforces both the new topic and the foundation it sits on.` },
      { title: 'Knowing when to use it', body: `${t} is the right tool for a well-defined set of situations. Part of this lesson is developing the instinct for those situations, so you reach for it quickly when it fits and look elsewhere when it does not.` },
    ],
    [
      { title: 'Under the hood', body: `Understanding how ${t} actually works changes the way you write and optimise it. This section stays practical, covering only the internal details that are directly useful when something goes wrong or performance is a concern.` },
      { title: 'Real-world examples', body: `The examples in this section are drawn from real ${ctx} scenarios. Working through them concretely is much more effective than studying abstract definitions, and it gives you patterns you can reuse immediately.` },
      { title: 'The subtleties that matter', body: `A handful of edge cases and constraints around ${t} catch people out regularly. Knowing them now, before you hit them under a deadline, is one of the highest-leverage things this lesson can give you.` },
    ],
  ];

  const tips = [
    `When you first apply ${t} on a real problem, write it out in the simplest form that works. Complexity can always be added later; clarity established early is much harder to recover once you have lost it.`,
    `After finishing this lesson, try explaining ${t} out loud in one or two sentences. If you struggle to find the words, that is exactly the part worth re-reading before moving on.`,
    `Pay close attention to the boundary conditions of ${t}. Edge cases are where the real behaviour lives, and they are the first thing to check when something in ${ctx} does not behave as expected.`,
    `The first time ${t} solves a problem that would otherwise have taken much longer, take a moment to note why it worked. That concrete memory is far more durable than any abstract definition.`,
  ];

  const keyPointSets: string[][] = [
    [
      `${t} follows a consistent set of rules that become second nature with practice`,
      `Most errors with ${t} happen at the boundary conditions, not in the common case`,
      `Mastering ${t} makes many other ${ctx} tasks noticeably faster`,
    ],
    [
      `The vocabulary around ${t} is precise — small differences in wording carry real meaning`,
      `${t} appears in many ${ctx} contexts, but the underlying logic stays the same`,
      `When output looks wrong, check the constraints specific to ${t} first`,
    ],
    [
      `Start with the simplest correct use of ${t} before adding complexity`,
      `${t} has documented edge cases worth knowing before you hit them in practice`,
      `Combining ${t} with other ${ctx} concepts is where real fluency shows`,
    ],
    [
      `A clear mental model of ${t} is more durable than memorised steps`,
      `Experienced ${ctx} practitioners apply ${t} almost automatically — repetition builds that`,
      `When debugging ${t} problems, trace backwards from the unexpected output`,
    ],
  ];

  const examples = [
    `Suppose you are working on a ${ctx} task and need to apply ${t}. Start with the minimal form, verify it produces the expected result, then extend only once the baseline is confirmed.`,
    `A typical ${ctx} workflow using ${t} begins by defining the expected output clearly. Working backwards from that definition shows exactly where ${t} fits and what it needs as input.`,
    `When ${t} first appears in a real ${ctx} project it often looks more complex than it is. Isolating just that part of the problem and applying ${t} in isolation usually clarifies it quickly.`,
    `Compare two approaches in ${ctx}: one that uses ${t} correctly and one that does not. The difference in the results is usually the fastest way to build intuition for what ${t} actually does.`,
  ];

  const ci = h % conceptSets.length;
  return {
    intro: intros[h % intros.length],
    concepts: conceptSets[ci],
    keyPoints: keyPointSets[(h + 1) % keyPointSets.length],
    example: examples[(h + 3) % examples.length],
    tip: tips[(h + 2) % tips.length],
  };
}

// ─── Chapter quiz ────────────────────────────────────────────────────────────

function firstSentence(s: string): string {
  const m = s.match(/^[^.!?]+[.!?]/);
  return m ? m[0].trim() : s.slice(0, 90).trim();
}

function clip(s: string, max = 62): string {
  const sent = firstSentence(s);
  return sent.length > max ? sent.slice(0, max - 1) + '…' : sent;
}

// Returns 3 distinct strings from `pool` (excluding `exclude`), cycling by seed.
function pickThree(pool: string[], exclude: string, seed: number): [string, string, string] {
  const unique = [...new Set(pool.filter(s => s !== exclude))];
  if (unique.length === 0) unique.push(exclude); // degenerate fallback
  const a = unique[seed % unique.length];
  const rest = unique.filter(s => s !== a);
  const b = rest.length ? rest[(seed + 1) % rest.length] : a;
  const rest2 = unique.filter(s => s !== a && s !== b);
  const c = rest2.length ? rest2[(seed + 2) % rest2.length] : b;
  return [a, b, c];
}

export function generateChapterQuiz(
  chapterName: string,
  lessons: string[],
  courseTopic: string,
  aiContents?: Map<string, LessonContent>
): QuizQuestion[] {
  if (lessons.length === 0) return [];
  const h = hash(chapterName);
  const n = lessons.length;

  // Use AI-generated content when all lessons in this chapter have been fetched
  const hasAI = aiContents && lessons.every(l => aiContents.has(l));
  const contents: LessonContent[] = hasAI
    ? lessons.map(l => aiContents!.get(l)!)
    : lessons.map(l => generateLessonContent(l, courseTopic));

  // ── Pools of answer material ──────────────────────────────────────────────
  const allConceptTitles = contents.flatMap(c => c.concepts.map(x => x.title));
  const allConceptBodies = contents.flatMap(c => c.concepts.map(x => clip(x.body)));
  const allTips          = contents.map(c => clip(c.tip));
  const allKeyPoints     = contents.flatMap(c => c.keyPoints ?? []);
  const allExamples      = contents.map(c => c.example ? clip(c.example) : null).filter(Boolean) as string[];

  const questions: QuizQuestion[] = [];

  // Q1 — description in stem → concept title as answer
  const i1 = h % n;
  const j1 = h % 3;
  const title1 = contents[i1].concepts[j1].title;
  const body1  = clip(contents[i1].concepts[j1].body);
  questions.push(makeQ('cq1',
    `Which concept is described as: "${body1}"?`,
    title1,
    pickThree(allConceptTitles, title1, h),
    h,
  ));

  // Q2 — concept title in stem → body excerpt as answer
  const i2 = (h + 1) % n;
  const j2 = (h + 1) % 3;
  const title2 = contents[i2].concepts[j2].title;
  const body2  = clip(contents[i2].concepts[j2].body);
  questions.push(makeQ('cq2',
    `What does the concept "${title2}" refer to?`,
    body2,
    pickThree(allConceptBodies, body2, h + 1),
    h + 1,
  ));

  // Q3 — key takeaway recall
  const i3 = (h + 2) % n;
  const kps3 = contents[i3].keyPoints ?? [];
  const kp3  = kps3.length ? kps3[h % kps3.length] : clip(contents[i3].tip);
  const kpPool = allKeyPoints.length >= 4 ? allKeyPoints : [...allKeyPoints, ...allConceptTitles];
  questions.push(makeQ('cq3',
    `Which of the following is a key takeaway from this chapter?`,
    kp3,
    pickThree(kpPool, kp3, h + 2),
    h + 2,
  ));

  // Q4 — practical tip recall
  const i4 = (h + 3) % n;
  const tip4 = clip(contents[i4].tip);
  questions.push(makeQ('cq4',
    `Which statement reflects practical advice from this chapter?`,
    tip4,
    pickThree(allTips, tip4, h + 3),
    h + 3,
  ));

  // Q5 — example recall, or fallback to another concept question
  const i5 = (h + 4) % n;
  if (allExamples.length >= 2) {
    const ex5 = clip(contents[i5].example ?? contents[i5].tip);
    questions.push(makeQ('cq5',
      `Which describes a real-world application covered in this chapter?`,
      ex5,
      pickThree(allExamples, ex5, h + 4),
      h + 4,
    ));
  } else {
    const j5 = (h + 2) % 3;
    const title5 = contents[i5].concepts[j5].title;
    const body5  = clip(contents[i5].concepts[j5].body);
    questions.push(makeQ('cq5',
      `Which concept is described as: "${body5}"?`,
      title5,
      pickThree(allConceptTitles, title5, h + 4),
      h + 4,
    ));
  }

  return questions;
}
