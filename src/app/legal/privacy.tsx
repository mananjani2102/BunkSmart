import { LegalDocument } from '@/components/LegalDocument';
import { PRIVACY_POLICY } from '@/constants/legal';

export default function PrivacyPolicyScreen() {
  return <LegalDocument document={PRIVACY_POLICY} />;
}
