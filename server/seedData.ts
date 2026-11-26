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
