import { LegalDocument } from '@/components/LegalDocument';
import { TERMS_AND_CONDITIONS } from '@/constants/legal';

export default function TermsAndConditionsScreen() {
  return <LegalDocument document={TERMS_AND_CONDITIONS} />;
}
