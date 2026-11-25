export type VoiceControlCandidate = { label: string; kind: 'button' | 'link' | 'input' | 'select' | 'other'; isSubmit?: boolean };

export function normalizeVoiceText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();
}

export function stripVoiceActionPrefix(value: string): string {
  return normalizeVoiceText(value).replace(/^(click|press|select|choose|focus|open|खोलो|दबाओ|चुनो|select karo)\s+/u, '');
}

export function isHighImpactVoiceAction(candidate: VoiceControlCandidate): boolean {
  const label = normalizeVoiceText(candidate.label);
  const highImpact = /\b(delete|remove|publish|post|send|pay|purchase|invite|approve|merge|deploy|logout|sign out|transfer|refund|cancel subscription)\b|हटाएं|भेजें|प्रकाशित|मंजूर|भुगतान/u.test(label);
  return Boolean(candidate.isSubmit || highImpact);
}

export function findVoiceControl<T extends VoiceControlCandidate>(command: string, candidates: T[]): T | undefined {
  const wanted = stripVoiceActionPrefix(command);
  if (!wanted) return undefined;
  return candidates.find(candidate => {
    const label = normalizeVoiceText(candidate.label);
    return label === wanted || (wanted.length > 2 && label.includes(wanted));
  });
}
