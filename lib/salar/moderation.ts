import 'server-only';

export type SalarModerationCategory = 'abuse' | 'spam' | 'sexual_minors' | 'attack' | 'illegal_instruction';
export type SalarModerationResult = {
  ok: true;
  flag: boolean;
  categories: SalarModerationCategory[];
  severity: 'none' | 'low' | 'medium' | 'high';
};

function normalized(value: unknown) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 2000);
}

function repeatedSpam(text: string) {
  const urls = text.match(/https?:\/\//g)?.length || 0;
  const repeatedChars = /(.)\1{14,}/.test(text);
  const words = text.split(/\s+/).filter(Boolean);
  const unique = new Set(words);
  const lowVariety = words.length >= 30 && unique.size <= Math.max(3, Math.floor(words.length * 0.18));
  return urls >= 4 || repeatedChars || lowVariety;
}

export function moderateSalarText(input: unknown): SalarModerationResult {
  const text = normalized(input);
  if (!text) return { ok: true, flag: false, categories: [], severity: 'none' };

  const categories: SalarModerationCategory[] = [];
  const minor = /\b(child|children|minor|underage|kid|kids|bach(?:a|ay|i)|bacha|bachi)\b/i.test(text);
  const sexual = /\b(sex|sexual|nude|naked|porn|explicit|rape|molest|intercourse)\b/i.test(text);
  if (minor && sexual) categories.push('sexual_minors');

  const harmfulTarget = /\b(kill|murder|shoot|stab|poison|hurt|attack|mar(?:na|o)|jaan se|zakhmi)\b/i.test(text);
  const actionable = /\b(how|kaise|steps?|method|tarika|tareeqa|guide|instructions?|banau|banaun|karun|do it)\b/i.test(text);
  if (harmfulTarget && actionable) categories.push('attack');

  const illegalTopic = /\b(bomb|explosive|weapon|hack|phish|malware|ransomware|steal|fraud|scam|counterfeit|credit card dump|drug lab|meth|cocaine)\b/i.test(text);
  if (illegalTopic && actionable) categories.push('illegal_instruction');

  if (/\b(fuck|fucking|bitch|bastard|asshole|madarchod|behenchod|bhenchod|chutiya|harami)\b/i.test(text)) categories.push('abuse');
  if (repeatedSpam(text)) categories.push('spam');

  const unique = [...new Set(categories)];
  const severity: SalarModerationResult['severity'] = unique.includes('sexual_minors') || unique.includes('attack') || unique.includes('illegal_instruction')
    ? 'high'
    : unique.includes('spam')
      ? 'medium'
      : unique.length
        ? 'low'
        : 'none';
  return { ok: true, flag: unique.length > 0, categories: unique, severity };
}
