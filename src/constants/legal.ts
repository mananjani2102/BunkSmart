import { type Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';

export const AUTHOR_NAME = 'Jani Manan';
export const CONTACT_EMAIL = 'manan.jani.cg@gmail.com';
export const LEGAL_LAST_UPDATED = '28 November 2026';

export type LegalIconName = ComponentProps<typeof Ionicons>['name'];

export interface LegalHighlight {
  icon: LegalIconName;
  label: string;
  detail: string;
}

export interface LegalSection {
  heading: string;
  icon: LegalIconName;
  paragraphs: readonly string[];
  bullets?: readonly string[];
}

export interface LegalDocumentContent {
  title: string;
  badge: string;
  badgeIcon: LegalIconName;
  subtitle: string;
  lastUpdated: string;
  highlights: readonly LegalHighlight[];
  sections: readonly LegalSection[];
  alternateLabel: string;
  alternateHref: '/legal/terms' | '/legal/privacy';
  footerNote: string;
}

export const PRIVACY_POLICY: LegalDocumentContent = {
  title: 'Privacy Policy',
  badge: 'Data & Privacy',
  badgeIcon: 'shield-checkmark-outline',
  subtitle:
    'How BunkSmart collects, stores, and protects your account and attendance information.',
  lastUpdated: LEGAL_LAST_UPDATED,
  highlights: [
    {
      icon: 'lock-closed-outline',
      label: 'Scoped to your account',
      detail:
        'Passwords are hashed by Supabase Auth, and row level security restricts database access to your own rows.',
    },
    {
      icon: 'eye-off-outline',
      label: 'No ads or third-party tracking',
      detail:
        'BunkSmart contains no advertising SDKs, analytics trackers, or third-party data sharing.',
    },
    {
      icon: 'trash-outline',
      label: 'Full deletion control',
      detail:
        'Clear all attendance records anytime from Settings & Profile, or email to remove your entire account.',
    },
  ],
  sections: [
    {
      heading: '1. Scope and Developer',
      icon: 'information-circle-outline',
      paragraphs: [
        `This Privacy Policy explains how BunkSmart ("the app"), developed and maintained by ${AUTHOR_NAME}, handles your personal information across Android, iOS, and Web.`,
        'By creating an account or signing in to BunkSmart, you acknowledge the collection and use of information as described in this policy.',
      ],
    },
    {
      heading: '2. Information You Provide',
      icon: 'document-text-outline',
      paragraphs: [
        'BunkSmart stores only the information required to manage and sync your attendance records:',
      ],
      bullets: [
        'Account information: your full name, email address, and a password hashed and managed by Supabase Auth.',
        'Academic configuration: your subjects, per-subject target percentages, default target preference, weekly timetable slots, and optional starting or college baseline attendance counts.',
        'Attendance logs: daily class statuses (present, absent, or cancelled) along with their dates.',
      ],
    },
    {
      heading: '3. Timetable Import Processing',
      icon: 'clipboard-outline',
      paragraphs: [
        'When you paste timetable text into the importer, that raw text is parsed directly on your device and is never stored on the server. Only the structured subjects and weekly class slots you choose to import are saved.',
      ],
    },
    {
      heading: '4. Cloud Storage and Security',
      icon: 'server-outline',
      paragraphs: [
        'Your account and attendance records are stored in a Supabase hosted Postgres database with row level security (RLS) enabled on every table.',
        'Database policies enforce that signed-in users can read, insert, update, or delete only their own records.',
        'The developer retains administrative access to the backend strictly for technical maintenance, troubleshooting, and fulfilling account deletion requests.',
      ],
    },
    {
      heading: '5. Local Device Storage and Reminders',
      icon: 'phone-portrait-outline',
      paragraphs: [
        'BunkSmart stores your login session, the theme mode, reminder settings, and a cached copy of your profile, subjects, timetable, and attendance on your device for faster loading, all of which except the theme mode are removed when you log out.',
        'If you choose a profile photo from your photo library, it stays on your device only and is never uploaded to our servers.',
        'On Android and iOS, optional class reminders are scheduled locally on your device only. BunkSmart does not collect push notification tokens or send remote notifications.',
      ],
    },
    {
      heading: '6. Data Not Collected or Shared',
      icon: 'ban-outline',
      paragraphs: [
        'BunkSmart does not access or collect your device location, contacts, camera feed, microphone, or advertising identifiers.',
        'Your personal data is never sold, rented, or shared with third-party advertisers, data brokers, or analytics providers.',
      ],
    },
    {
      heading: '7. Data Retention and Deletion',
      icon: 'trash-outline',
      paragraphs: [
        'Your records are retained for as long as your account remains active. You control your data in two ways:',
      ],
      bullets: [
        'Reset attendance data: permanently delete all subjects, timetable classes, and attendance logs anytime inside Settings & Profile while keeping your account.',
        `Delete your account: email ${CONTACT_EMAIL} from your registered email address to request permanent deletion of your account and authentication credentials.`,
      ],
    },
    {
      heading: '8. Policy Changes and Contact',
      icon: 'mail-outline',
      paragraphs: [
        'This Privacy Policy may be revised as BunkSmart changes. Any update changes the Last updated date shown at the top of this page.',
        `If you have privacy questions or data deletion requests, write to ${CONTACT_EMAIL}.`,
      ],
    },
  ],
  alternateLabel: 'Read Terms and Conditions',
  alternateHref: '/legal/terms',
  footerNote: `Maintained by ${AUTHOR_NAME}. Applies to BunkSmart mobile and web clients.`,
};

export const TERMS_AND_CONDITIONS: LegalDocumentContent = {
  title: 'Terms and Conditions',
  badge: 'Terms of Use',
  badgeIcon: 'document-text-outline',
  subtitle:
    'The terms governing your access to and use of BunkSmart across mobile and web.',
  lastUpdated: LEGAL_LAST_UPDATED,
  highlights: [
    {
      icon: 'calculator-outline',
      label: 'Planning aid only',
      detail:
        'Percentages and skip limits rely on the entries you record. Official college records always govern.',
    },
    {
      icon: 'person-outline',
      label: 'Account responsibility',
      detail:
        'Keep your login credentials secure and review your attendance entries for accuracy.',
    },
    {
      icon: 'cloud-outline',
      label: 'Provided as is',
      detail:
        'BunkSmart is an independent student project provided without warranty or uptime guarantee.',
    },
  ],
  sections: [
    {
      heading: '1. Acceptance of Terms',
      icon: 'checkmark-circle-outline',
      paragraphs: [
        'By creating an account or using BunkSmart, you agree to comply with these Terms and Conditions.',
        'If you do not agree to these terms, discontinue use of the application.',
      ],
    },
    {
      heading: '2. Academic Tracking Disclaimer',
      icon: 'school-outline',
      paragraphs: [
        'BunkSmart is an attendance planning aid designed to help you estimate progress against your personal target percentages.',
        'All calculations, safe-skip counts, and recovery estimates are derived exclusively from the starting figures, timetable slots, and class statuses you enter.',
        "Your institution's official attendance portal and academic policies always take priority. Verify official records before relying on any calculation or skip margin in BunkSmart.",
      ],
    },
    {
      heading: '3. User Responsibilities and Acceptable Use',
      icon: 'person-circle-outline',
      paragraphs: [
        'You are responsible for keeping your password confidential and for all activity performed under your account.',
        'When using BunkSmart, you agree not to:',
      ],
      bullets: [
        'Attempt to access, modify, or probe accounts or data belonging to other users.',
        'Bypass authentication, row level security, or service safeguards.',
        'Disrupt, overload, or misuse the application or its backend infrastructure.',
      ],
    },
    {
      heading: '4. Service Availability and Warranty',
      icon: 'server-outline',
      paragraphs: [
        `BunkSmart is an independent student project created by ${AUTHOR_NAME} and is provided on an "as is" and "as available" basis, without express or implied warranties of reliability, accuracy, or fitness for a particular purpose.`,
        'Features may change or be discontinued at any time. Because the backend runs on free-tier hosting, prolonged inactivity may temporarily pause database access.',
      ],
    },
    {
      heading: '5. Limitation of Liability',
      icon: 'alert-circle-outline',
      paragraphs: [
        `To the fullest extent permitted by applicable law, ${AUTHOR_NAME} is not liable for any direct, indirect, incidental, or consequential damages resulting from your use of or inability to use BunkSmart.`,
        'This includes academic or administrative consequences arising from low attendance, missed classes, calculation discrepancies, service pauses, or data loss.',
      ],
    },
    {
      heading: '6. Termination',
      icon: 'exit-outline',
      paragraphs: [
        'You may stop using BunkSmart at any time and remove your attendance records from Settings & Profile.',
        'Accounts used to abuse the service, attempt unauthorized access, or violate these terms may be suspended or deleted without prior notice.',
      ],
    },
    {
      heading: '7. Contact',
      icon: 'mail-outline',
      paragraphs: [
        `For questions regarding these Terms and Conditions, contact ${AUTHOR_NAME} at ${CONTACT_EMAIL}.`,
      ],
    },
  ],
  alternateLabel: 'Read Privacy Policy',
  alternateHref: '/legal/privacy',
  footerNote: `Maintained by ${AUTHOR_NAME}. Applies to BunkSmart mobile and web clients.`,
};
