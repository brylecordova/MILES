import type { Course } from '../src/types/training.ts';

export function getSeedCourses(): Course[] {
  const now = new Date().toISOString();

  return [
    {
      _id: 'course-workplace-safety',
      title: 'Workplace Safety & Emergency Response',
      description:
        'Master lockout-tagout energy isolation, personal protective equipment standards, hazard identification, and emergency response protocols for industrial facilities.',
      category: 'Industrial Safety',
      bannerUrl: '/src/assets/images/course_safety_banner_1795694649926.jpg',
      certificateTitle: 'Certified Workplace Safety Specialist',
      issuerName: 'CertiField Safety Institute',
      published: true,
      averageRating: 4.8,
      ratingCount: 4,
      ratings: [
        { userId: 'user-seed-elena', rating: 5, updatedAt: now },
        { userId: 'user-seed-marcus', rating: 5, updatedAt: now },
        { userId: 'user-seed-priya', rating: 4, updatedAt: now },
        { userId: 'user-seed-david', rating: 5, updatedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
      modules: [
        {
          id: 'mod-ws-l1',
          kind: 'lesson',
          title: 'Personal Protective Equipment & Hazard Zones',
          estimatedMinutes: 6,
          blocks: [
            {
              id: 'b-ws-1',
              type: 'header',
              level: 1,
              text: 'Core PPE Requirements in Active Zones',
            },
            {
              id: 'b-ws-2',
              type: 'body',
              text: 'Every technician entering an active warehouse or machinery bay must verify **three layers of physical protection** before crossing marked floor boundaries.',
            },
            {
              id: 'b-ws-3',
              type: 'image',
              url: '/src/assets/images/lesson_inspection_diagram_1795694651098.jpg',
              caption: 'Pressure gauge and tagged ball valve assembly prior to maintenance sign-off.',
            },
            {
              id: 'b-ws-4',
              type: 'header',
              level: 2,
              text: 'Mandatory Gear Checklist',
            },
            {
              id: 'b-ws-5',
              type: 'bullets',
              items: [
                'ANSI Z89.1 Class E hard hat with undamaged suspension harness',
                'High-visibility Class 2 vest fastened securely at the torso',
                'ASTM F2413 composite or steel-toe safety footwear',
                'Side-shielded impact-rated eyewear in machining aisles',
              ],
            },
          ],
        },
        {
          id: 'mod-ws-l2',
          kind: 'lesson',
          title: 'Lockout-Tagout (LOTO) Energy Isolation',
          estimatedMinutes: 8,
          blocks: [
            {
              id: 'b-ws-6',
              type: 'video',
              url: '/media/safety-loto-brief.mp4',
              caption: 'Field briefing: 2-step energy isolation and personal padlock placement.',
            },
            {
              id: 'b-ws-7',
              type: 'header',
              level: 1,
              text: 'Six Steps of Hazardous Energy Control',
            },
            {
              id: 'b-ws-8',
              type: 'body',
              text: 'Stored electrical, pneumatic, and hydraulic energy causes severe injuries when machines restart unexpectedly. Never rely on a control switch alone—always isolate the primary disconnect and verify **zero energy state**.',
            },
            {
              id: 'b-ws-9',
              type: 'bullets',
              items: [
                'Prepare and notify all affected operators in the work cell',
                'Shut down the equipment using normal operating stops',
                'Isolate all energy sources at main disconnects or valves',
                'Apply your personal padlock and signed danger tag',
                'Release or restrain any stored residual pressure',
                'Verify zero energy by attempting a normal start test',
              ],
            },
          ],
        },
        {
          id: 'mod-ws-q1',
          kind: 'quiz',
          title: 'Checkpoint 1: PPE & Energy Isolation',
          description:
            'Confirm your mastery of PPE inspection and Lockout-Tagout rules before advancing to emergency response.',
          passingScore: 70,
          failureRule: 'restart_since_last_quiz',
          passingRule: 'proceed_next',
          questions: [
            {
              id: 'q-ws-1',
              type: 'multiple_choice',
              topicTag: 'Lockout-Tagout',
              prompt: 'After applying your personal padlock and tag to an isolation valve, what must you do before starting repairs?',
              options: [
                'Ask a supervisor to sign a paper log only',
                'Verify zero energy state by testing controls and checking gauges',
                'Leave the machine running for 30 seconds to warm up',
                'Remove the danger tag so it does not get dirty',
              ],
              correctIndex: 1,
              explanation:
                'Always perform a zero-energy verification (try-start test and gauge check) after locking out to confirm all stored energy is dissipated.',
            },
            {
              id: 'q-ws-2',
              type: 'true_false',
              topicTag: 'Lockout-Tagout',
              prompt: 'A coworker may cut off your personal LOTO padlock if your shift ends while the valve is still locked.',
              correctIndex: 1,
              explanation:
                'False. Only the technician who placed the personal lock may remove it, except under strict emergency supervisor verification procedures.',
            },
            {
              id: 'q-ws-3',
              type: 'select_all',
              topicTag: 'PPE Standards',
              prompt: 'Select all items required before entering an active machining aisle.',
              options: [
                'ANSI-rated hard hat',
                'High-visibility safety vest',
                'Open-toe canvas shoes',
                'Impact-rated safety eyewear',
              ],
              correctIndices: [0, 1, 3],
              explanation:
                'Active machining aisles require head protection, high-visibility apparel, impact eyewear, and ASTM-rated safety footwear (never open-toe shoes).',
            },
          ],
        },
        {
          id: 'mod-ws-l3',
          kind: 'lesson',
          title: 'Emergency Evacuation & Incident Reporting',
          estimatedMinutes: 5,
          blocks: [
            {
              id: 'b-ws-10',
              type: 'header',
              level: 1,
              text: 'Responding to Alarms & Chemical Releases',
            },
            {
              id: 'b-ws-11',
              type: 'body',
              text: 'When a facility evacuation alarm sounds, power down active hand tools if safe within three seconds, proceed via the nearest green-lit exit corridor, and assemble at your designated muster point for headcount.',
            },
            {
              id: 'b-ws-12',
              type: 'header',
              level: 2,
              text: 'Immediate Post-Incident Protocol',
            },
            {
              id: 'b-ws-13',
              type: 'body',
              text: 'Report near-misses within **one hour** so engineering can eliminate root hazards before an injury occurs.',
            },
          ],
        },
        {
          id: 'mod-ws-q2',
          kind: 'quiz',
          title: 'Final Assessment: Emergency Response',
          description:
            'Complete the final evaluation including a written incident scenario response.',
          passingScore: 75,
          failureRule: 'restart_course',
          passingRule: 'require_manual_review',
          questions: [
            {
              id: 'q-ws-4',
              type: 'multiple_choice',
              topicTag: 'Emergency Response',
              prompt: 'What is your first priority when a continuous facility evacuation horn sounds?',
              options: [
                'Finish your repair ticket so tools are not left out',
                'Secure active tools safely and exit to your muster point',
                'Use the freight elevator to reach the ground floor faster',
                'Silence the horn at the nearest wall panel',
              ],
              correctIndex: 1,
              explanation:
                'Never use elevators or delay evacuation for routine tasks. Safely disengage tools and proceed immediately to your muster station.',
            },
            {
              id: 'q-ws-5',
              type: 'essay',
              topicTag: 'Incident Reporting',
              prompt: 'Describe the exact steps you take if you discover an unlabeled hydraulic leak near a walkway.',
              essayRubricKeywords: ['isolate', 'report', 'barricade', 'clean', 'supervisor', 'hazard'],
              modelAnswer:
                'Secure or barricade the walkway to prevent slips, notify the floor supervisor and safety officer immediately, and isolate the leak source before cleanup.',
              explanation:
                'Effective hazard response combines immediate area isolation/barricading with prompt supervisor reporting.',
            },
          ],
        },
      ],
    },
    {
      _id: 'course-clinical-hygiene',
      title: 'Clinical Hygiene & Sterile Protocol',
      description:
        'Evidence-based aseptic technique, surgical hand antisepsis, sterile field maintenance, and biohazard containment for clinical teams.',
      category: 'Healthcare Compliance',
      bannerUrl: '/src/assets/images/course_clinical_banner_1795694650320.jpg',
      certificateTitle: 'Certified Sterile Protocol Practitioner',
      issuerName: 'CertiField Clinical Board',
      published: true,
      averageRating: 4.3,
      ratingCount: 3,
      ratings: [
        { userId: 'user-seed-elena', rating: 5, updatedAt: now },
        { userId: 'user-seed-priya', rating: 4, updatedAt: now },
        { userId: 'user-seed-david', rating: 4, updatedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
      modules: [
        {
          id: 'mod-ch-l1',
          kind: 'lesson',
          title: 'Aseptic Hand Hygiene & Gloving',
          estimatedMinutes: 7,
          blocks: [
            {
              id: 'b-ch-1',
              type: 'header',
              level: 1,
              text: 'Surgical Scrub & Contamination Boundaries',
            },
            {
              id: 'b-ch-2',
              type: 'body',
              text: 'Proper hand antisepsis eliminates transient flora before donning sterile gloves. Keep hands elevated above elbows throughout rinsing so water drains away from fingertips.',
            },
            {
              id: 'b-ch-3',
              type: 'video',
              url: '/media/clinical-sterile-brief.mp4',
              caption: '40-second hand antisepsis and closed-cuff gloving demonstration.',
            },
            {
              id: 'b-ch-4',
              type: 'bullets',
              items: [
                'Remove all rings, watches, and wrist jewelry prior to scrub',
                'Maintain a 40–60 second friction wash covering thumbs and nailbeds',
                'Never touch non-sterile packaging surfaces once gloved',
              ],
            },
          ],
        },
        {
          id: 'mod-ch-l2',
          kind: 'lesson',
          title: 'Maintaining the Sterile Field',
          estimatedMinutes: 6,
          blocks: [
            {
              id: 'b-ch-5',
              type: 'header',
              level: 1,
              text: 'Rules of the 1-Inch Perimeter',
            },
            {
              id: 'b-ch-6',
              type: 'body',
              text: 'The outer **1-inch (2.5 cm) border** of any sterile drape is considered unsterile. Never reach across an open sterile tray, and never turn your back on an uncovered sterile field.',
            },
          ],
        },
        {
          id: 'mod-ch-q1',
          kind: 'quiz',
          title: 'Clinical Sterility Certification Exam',
          description: 'Demonstrate full command of aseptic boundaries and sterile workflow.',
          passingScore: 70,
          failureRule: 'retry_quiz',
          passingRule: 'proceed_next',
          questions: [
            {
              id: 'q-ch-1',
              type: 'true_false',
              topicTag: 'Sterile Field',
              prompt: 'Items placed within the outer 1-inch edge of a sterile drape remain sterile if dry.',
              correctIndex: 1,
              explanation:
                'False. The outer 1-inch margin of a sterile drape is always treated as contaminated.',
            },
            {
              id: 'q-ch-2',
              type: 'select_all',
              topicTag: 'Asepsis',
              prompt: 'Select all actions that compromise a sterile field.',
              options: [
                'Reaching an ungloved arm over the sterile tray',
                'Keeping gloved hands above waist level',
                'Turning your back on the open tray unattended',
                'Allowing moisture to soak through the drape',
              ],
              correctIndices: [0, 2, 3],
              explanation:
                'Keeping gloved hands above waist level preserves sterility; reaching over, turning away, and strike-through moisture all contaminate the field.',
            },
            {
              id: 'q-ch-3',
              type: 'essay',
              topicTag: 'Contamination Recovery',
              prompt: 'What corrective action is required if a sterile instrument accidentally touches the edge of a non-sterile table?',
              essayRubricKeywords: ['replace', 'contaminated', 'sterile', 'remove', 'discard'],
              modelAnswer:
                'Immediately consider the instrument contaminated, remove it from the sterile field, and replace it with a newly opened sterile instrument.',
              explanation:
                'Any contact with a non-sterile surface breaks sterility; the item must be removed and replaced immediately.',
            },
          ],
        },
      ],
    },
    {
      _id: 'course-data-privacy',
      title: 'Data Privacy & Security Foundations',
      description:
        'Phishing defense, multi-factor authentication hygiene, endpoint encryption, and GDPR/PII handling for distributed operations teams.',
      category: 'Information Security',
      bannerUrl: '/src/assets/images/course_security_banner_1795694650637.jpg',
      certificateTitle: 'Certified Data Privacy Associate',
      issuerName: 'CertiField Trust Academy',
      published: true,
      averageRating: 5.0,
      ratingCount: 2,
      ratings: [
        { userId: 'user-seed-elena', rating: 5, updatedAt: now },
        { userId: 'user-seed-marcus', rating: 5, updatedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
      modules: [
        {
          id: 'mod-dp-l1',
          kind: 'lesson',
          title: 'Hardware MFA & Phishing Resistance',
          estimatedMinutes: 5,
          blocks: [
            {
              id: 'b-dp-1',
              type: 'header',
              level: 1,
              text: 'Why FIDO2 Keys Stop Credential Replay',
            },
            {
              id: 'b-dp-2',
              type: 'body',
              text: 'Unlike SMS codes, cryptographic passkeys and hardware security keys bind authentication strictly to the verified origin domain, preventing lookalike phishing domains from capturing usable tokens.',
            },
            {
              id: 'b-dp-3',
              type: 'bullets',
              items: [
                'Inspect sender domain mismatches before opening attachments',
                'Never approve unexpected MFA push prompts',
                'Report suspicious messages to the security desk within 15 minutes',
              ],
            },
          ],
        },
        {
          id: 'mod-dp-q1',
          kind: 'quiz',
          title: 'Security Foundations Assessment',
          description: 'Verify core security hygiene and data classification rules.',
          passingScore: 80,
          failureRule: 'retry_quiz',
          passingRule: 'proceed_next',
          questions: [
            {
              id: 'q-dp-1',
              type: 'multiple_choice',
              topicTag: 'Authentication',
              prompt: 'Which multi-factor method provides the strongest protection against lookalike phishing sites?',
              options: [
                'SMS one-time text code',
                'FIDO2 hardware security key',
                'Security questions about your hometown',
                'Reusing a complex password',
              ],
              correctIndex: 1,
              explanation:
                'FIDO2 hardware keys cryptographically verify the website origin before signing, blocking phishing proxies.',
            },
            {
              id: 'q-dp-2',
              type: 'true_false',
              topicTag: 'PII Handling',
              prompt: 'Exported customer spreadsheets containing emails and phone numbers may be stored on unencrypted personal USB drives while traveling.',
              correctIndex: 1,
              explanation:
                'False. Personal identifiable information (PII) must remain inside encrypted, access-controlled company systems.',
            },
          ],
        },
      ],
    },
  ];
}

export function getSeedAnalyticsData(now = new Date()): {
  users: Array<{
    _id: string;
    name: string;
    email: string;
    role: 'learner';
    createdAt: string;
    passwordHash: string;
  }>;
  downloads: Array<{
    _id: string;
    courseId: string;
    userId?: string;
    downloadedAt: string;
  }>;
  submissions: import('../src/types/training.ts').CourseSubmission[];
  certificates: import('../src/types/training.ts').CertificateRecord[];
} {
  const daysAgo = (d: number, hour = 14) => {
    const dt = new Date(now);
    dt.setUTCDate(dt.getUTCDate() - d);
    dt.setUTCHours(hour, 15, 0, 0);
    return dt.toISOString();
  };

  const users = [
    {
      _id: 'user-seed-elena',
      name: 'Elena Rostova',
      email: 'elena.rostova@fieldops.org',
      role: 'learner' as const,
      createdAt: daysAgo(12),
      passwordHash: 'seed-locked',
    },
    {
      _id: 'user-seed-marcus',
      name: 'Marcus Vance',
      email: 'marcus.vance@fieldops.org',
      role: 'learner' as const,
      createdAt: daysAgo(10),
      passwordHash: 'seed-locked',
    },
    {
      _id: 'user-seed-priya',
      name: 'Priya Nair',
      email: 'priya.nair@fieldops.org',
      role: 'learner' as const,
      createdAt: daysAgo(8),
      passwordHash: 'seed-locked',
    },
    {
      _id: 'user-seed-david',
      name: 'David Chen',
      email: 'david.chen@fieldops.org',
      role: 'learner' as const,
      createdAt: daysAgo(6),
      passwordHash: 'seed-locked',
    },
  ];

  const downloads = [
    { _id: 'dl-seed-1', courseId: 'course-workplace-safety', userId: 'user-seed-elena', downloadedAt: daysAgo(6) },
    { _id: 'dl-seed-2', courseId: 'course-clinical-hygiene', userId: 'user-seed-elena', downloadedAt: daysAgo(4) },
    { _id: 'dl-seed-3', courseId: 'course-data-privacy', userId: 'user-seed-elena', downloadedAt: daysAgo(2) },
    { _id: 'dl-seed-4', courseId: 'course-workplace-safety', userId: 'user-seed-marcus', downloadedAt: daysAgo(5) },
    { _id: 'dl-seed-5', courseId: 'course-data-privacy', userId: 'user-seed-marcus', downloadedAt: daysAgo(1) },
    { _id: 'dl-seed-6', courseId: 'course-workplace-safety', userId: 'user-seed-priya', downloadedAt: daysAgo(3) },
    { _id: 'dl-seed-7', courseId: 'course-clinical-hygiene', userId: 'user-seed-priya', downloadedAt: daysAgo(1) },
    { _id: 'dl-seed-8', courseId: 'course-workplace-safety', userId: 'user-seed-david', downloadedAt: daysAgo(2) },
    { _id: 'dl-seed-9', courseId: 'course-clinical-hygiene', userId: 'user-seed-david', downloadedAt: daysAgo(0, 9) },
  ];

  const submissions: import('../src/types/training.ts').CourseSubmission[] = [
    {
      _id: 'sub-seed-1',
      courseId: 'course-workplace-safety',
      courseTitle: 'Workplace Safety & Emergency Response',
      certificateTitle: 'Certified Workplace Safety Specialist',
      issuerName: 'CertiField Safety Institute',
      userId: 'user-seed-elena',
      userName: 'Elena Rostova',
      userEmail: 'elena.rostova@fieldops.org',
      overallScore: 96,
      passed: true,
      status: 'approved',
      reviewedAt: daysAgo(5),
      submittedAt: daysAgo(5, 11),
      readingDurationSeconds: 840,
      certificateId: 'cert-seed-1',
      questionResults: [
        {
          questionId: 'q-ws-1',
          quizId: 'mod-ws-q1',
          quizTitle: 'Checkpoint 1: PPE & Energy Isolation',
          questionPrompt: 'After applying your personal padlock and tag to an isolation valve, what must you do before starting repairs?',
          questionType: 'multiple_choice',
          topicTag: 'Lockout-Tagout',
          tries: 1,
          userAnswer: 1,
          userAnswerLabel: 'Verify zero energy state by testing controls and checking gauges',
          correctAnswerLabel: 'Verify zero energy state by testing controls and checking gauges',
          isCorrect: true,
          explanation: 'Always perform a zero-energy verification.',
        },
        {
          questionId: 'q-ws-4',
          quizId: 'mod-ws-q2',
          quizTitle: 'Final Assessment: Emergency Response',
          questionPrompt: 'What is your first priority when a continuous facility evacuation horn sounds?',
          questionType: 'multiple_choice',
          topicTag: 'Emergency Response',
          tries: 1,
          userAnswer: 1,
          userAnswerLabel: 'Secure active tools safely and exit to your muster point',
          correctAnswerLabel: 'Secure active tools safely and exit to your muster point',
          isCorrect: true,
          explanation: 'Proceed immediately to your muster station.',
        },
      ],
      quizResults: [
        { quizId: 'mod-ws-q1', quizTitle: 'Checkpoint 1: PPE & Energy Isolation', score: 100, passingScore: 70, passed: true, attempts: 1 },
        { quizId: 'mod-ws-q2', quizTitle: 'Final Assessment: Emergency Response', score: 92, passingScore: 75, passed: true, attempts: 1 },
      ],
    },
    {
      _id: 'sub-seed-2',
      courseId: 'course-clinical-hygiene',
      courseTitle: 'Clinical Hygiene & Sterile Protocol',
      certificateTitle: 'Certified Sterile Protocol Practitioner',
      issuerName: 'CertiField Clinical Board',
      userId: 'user-seed-elena',
      userName: 'Elena Rostova',
      userEmail: 'elena.rostova@fieldops.org',
      overallScore: 92,
      passed: true,
      status: 'approved',
      reviewedAt: daysAgo(3),
      submittedAt: daysAgo(3, 10),
      readingDurationSeconds: 690,
      certificateId: 'cert-seed-2',
      questionResults: [
        {
          questionId: 'q-ch-1',
          quizId: 'mod-ch-q1',
          quizTitle: 'Clinical Sterility Certification Exam',
          questionPrompt: 'Items placed within the outer 1-inch edge of a sterile drape remain sterile if dry.',
          questionType: 'true_false',
          topicTag: 'Sterile Field',
          tries: 1,
          userAnswer: 1,
          userAnswerLabel: 'False',
          correctAnswerLabel: 'False',
          isCorrect: true,
          explanation: 'The outer 1-inch margin is always treated as contaminated.',
        },
      ],
      quizResults: [
        { quizId: 'mod-ch-q1', quizTitle: 'Clinical Sterility Certification Exam', score: 92, passingScore: 70, passed: true, attempts: 1 },
      ],
    },
    {
      _id: 'sub-seed-3',
      courseId: 'course-workplace-safety',
      courseTitle: 'Workplace Safety & Emergency Response',
      certificateTitle: 'Certified Workplace Safety Specialist',
      issuerName: 'CertiField Safety Institute',
      userId: 'user-seed-marcus',
      userName: 'Marcus Vance',
      userEmail: 'marcus.vance@fieldops.org',
      overallScore: 81,
      passed: true,
      status: 'approved',
      reviewedAt: daysAgo(4),
      submittedAt: daysAgo(4, 16),
      readingDurationSeconds: 510,
      certificateId: 'cert-seed-3',
      questionResults: [
        {
          questionId: 'q-ws-1',
          quizId: 'mod-ws-q1',
          quizTitle: 'Checkpoint 1: PPE & Energy Isolation',
          questionPrompt: 'After applying your personal padlock and tag to an isolation valve, what must you do before starting repairs?',
          questionType: 'multiple_choice',
          topicTag: 'Lockout-Tagout',
          tries: 2,
          userAnswer: 1,
          userAnswerLabel: 'Verify zero energy state by testing controls and checking gauges',
          correctAnswerLabel: 'Verify zero energy state by testing controls and checking gauges',
          isCorrect: true,
          explanation: 'Always perform a zero-energy verification.',
        },
      ],
      quizResults: [
        { quizId: 'mod-ws-q1', quizTitle: 'Checkpoint 1: PPE & Energy Isolation', score: 80, passingScore: 70, passed: true, attempts: 2 },
        { quizId: 'mod-ws-q2', quizTitle: 'Final Assessment: Emergency Response', score: 82, passingScore: 75, passed: true, attempts: 1 },
      ],
    },
    {
      _id: 'sub-seed-4',
      courseId: 'course-clinical-hygiene',
      courseTitle: 'Clinical Hygiene & Sterile Protocol',
      certificateTitle: 'Certified Sterile Protocol Practitioner',
      issuerName: 'CertiField Clinical Board',
      userId: 'user-seed-priya',
      userName: 'Priya Nair',
      userEmail: 'priya.nair@fieldops.org',
      overallScore: 88,
      passed: true,
      status: 'pending_review',
      submittedAt: daysAgo(1, 13),
      readingDurationSeconds: 615,
      questionResults: [
        {
          questionId: 'q-ch-2',
          quizId: 'mod-ch-q1',
          quizTitle: 'Clinical Sterility Certification Exam',
          questionPrompt: 'Select all actions that compromise a sterile field.',
          questionType: 'select_all',
          topicTag: 'Asepsis',
          tries: 1,
          userAnswer: [0, 2, 3],
          userAnswerLabel: 'Reaching over tray, Turning back, Moisture strike-through',
          correctAnswerLabel: 'Reaching over tray, Turning back, Moisture strike-through',
          isCorrect: true,
          explanation: 'Keeping gloved hands above waist level preserves sterility.',
        },
      ],
      quizResults: [
        { quizId: 'mod-ch-q1', quizTitle: 'Clinical Sterility Certification Exam', score: 88, passingScore: 70, passed: true, attempts: 1 },
      ],
    },
    {
      _id: 'sub-seed-5',
      courseId: 'course-workplace-safety',
      courseTitle: 'Workplace Safety & Emergency Response',
      certificateTitle: 'Certified Workplace Safety Specialist',
      issuerName: 'CertiField Safety Institute',
      userId: 'user-seed-david',
      userName: 'David Chen',
      userEmail: 'david.chen@fieldops.org',
      overallScore: 58,
      passed: false,
      status: 'pending_review',
      submittedAt: daysAgo(0, 10),
      completedOfflineAt: daysAgo(0, 9),
      readingDurationSeconds: 165,
      questionResults: [
        {
          questionId: 'q-ws-3',
          quizId: 'mod-ws-q1',
          quizTitle: 'Checkpoint 1: PPE & Energy Isolation',
          questionPrompt: 'Select all items required before entering an active machining aisle.',
          questionType: 'select_all',
          topicTag: 'PPE Standards',
          tries: 3,
          userAnswer: [0, 1],
          userAnswerLabel: 'ANSI-rated hard hat, High-visibility safety vest',
          correctAnswerLabel: 'ANSI-rated hard hat, High-visibility safety vest, Impact-rated safety eyewear',
          isCorrect: false,
          explanation: 'Impact eyewear is required alongside hard hat and vest.',
        },
      ],
      quizResults: [
        { quizId: 'mod-ws-q1', quizTitle: 'Checkpoint 1: PPE & Energy Isolation', score: 58, passingScore: 70, passed: false, attempts: 3 },
      ],
    },
  ];

  const certificates: import('../src/types/training.ts').CertificateRecord[] = [
    {
      _id: 'cert-seed-1',
      certificateCode: 'CF-2026-9041B1',
      submissionId: 'sub-seed-1',
      courseId: 'course-workplace-safety',
      courseTitle: 'Workplace Safety & Emergency Response',
      certificateTitle: 'Certified Workplace Safety Specialist',
      issuerName: 'CertiField Safety Institute',
      userId: 'user-seed-elena',
      userName: 'Elena Rostova',
      userEmail: 'elena.rostova@fieldops.org',
      score: 96,
      issuedAt: daysAgo(5),
      emailedCount: 1,
    },
    {
      _id: 'cert-seed-2',
      certificateCode: 'CF-2026-8824D7',
      submissionId: 'sub-seed-2',
      courseId: 'course-clinical-hygiene',
      courseTitle: 'Clinical Hygiene & Sterile Protocol',
      certificateTitle: 'Certified Sterile Protocol Practitioner',
      issuerName: 'CertiField Clinical Board',
      userId: 'user-seed-elena',
      userName: 'Elena Rostova',
      userEmail: 'elena.rostova@fieldops.org',
      score: 92,
      issuedAt: daysAgo(3),
      emailedCount: 0,
    },
    {
      _id: 'cert-seed-3',
      certificateCode: 'CF-2026-7130A9',
      submissionId: 'sub-seed-3',
      courseId: 'course-workplace-safety',
      courseTitle: 'Workplace Safety & Emergency Response',
      certificateTitle: 'Certified Workplace Safety Specialist',
      issuerName: 'CertiField Safety Institute',
      userId: 'user-seed-marcus',
      userName: 'Marcus Vance',
      userEmail: 'marcus.vance@fieldops.org',
      score: 81,
      issuedAt: daysAgo(4),
      emailedCount: 0,
    },
  ];

  return { users, downloads, submissions, certificates };
}
