export const AUTHOR_NAME = 'Jani Manan';
export const CONTACT_EMAIL = 'manan.jani.cg@gmail.com';
export const LEGAL_LAST_UPDATED = '23 November 2026';

export interface LegalSection {
  heading: string;
  paragraphs: readonly string[];
}

export interface LegalDocumentContent {
  title: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
}

export const PRIVACY_POLICY: LegalDocumentContent = {
  title: 'Privacy Policy',
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      heading: 'About BunkSmart',
      paragraphs: [`BunkSmart is a student project by ${AUTHOR_NAME}.`],
    },
    {
      heading: 'Data stored in the app',
      paragraphs: [
        'BunkSmart stores your email, full name, and password. Passwords are handled by Supabase Auth and stored hashed.',
        'It also stores your subjects, attendance targets, weekly timetable, and attendance entries.',
        'It also stores the overall attendance numbers you choose to enter. The timetable text you paste for import is not stored, only the classes created from it.',
      ],
    },
    {
      heading: 'Where your data lives',
      paragraphs: [
        'Your data lives in a Supabase hosted database protected by row level security. Signed-in users can read only their own rows.',
        'The developer has administrator access to the project database for maintenance.',
      ],
    },
    {
      heading: 'Data stored on your device',
      paragraphs: [
        'Your device stores your login session and reminder settings.',
        'Reminders are local notifications scheduled on your device only. No push token is collected.',
      ],
    },
    {
      heading: 'What BunkSmart does not collect',
      paragraphs: [
        'The app does not collect location, contacts, photos, or an advertising ID. It has no analytics, ads, or third-party trackers.',
        'Your data is not sold or shared.',
      ],
    },
    {
      heading: 'Deleting your data',
      paragraphs: [
        'You can delete all your attendance data in Profile.',
        `To delete your account entirely, email ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Contact: ${CONTACT_EMAIL}`],
    },
  ],
};

export const TERMS_AND_CONDITIONS: LegalDocumentContent = {
  title: 'Terms and Conditions',
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      heading: 'Accepting these terms',
      paragraphs: ['By creating an account you accept these terms.'],
    },
    {
      heading: 'Tracking aid only',
      paragraphs: [
        "BunkSmart is a tracking aid. Percentages are calculated from entries you make and may differ from your institution's official records.",
        'Official records always take priority. Check official records before relying on a skip limit.',
      ],
    },
    {
      heading: 'Your responsibilities',
      paragraphs: [
        'You are responsible for the accuracy of your entries and for keeping your password safe.',
        "You must not try to access other people's data.",
      ],
    },
    {
      heading: 'Service availability and warranty',
      paragraphs: [
        'The app is a student project provided as is, without warranty.',
        'It may change or stop, and free hosting may pause it.',
      ],
    },
    {
      heading: 'Limits of liability',
      paragraphs: [
        'To the extent the law allows, the developer is not liable for consequences of low attendance, missed classes, or data loss.',
      ],
    },
    {
      heading: 'Ending use',
      paragraphs: [
        'You can stop using the app at any time. Accounts used to abuse the service may be removed.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Contact: ${CONTACT_EMAIL}`],
    },
  ],
};
