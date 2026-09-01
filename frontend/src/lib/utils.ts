/**
 * Strips superfluous AI emoji slop for clean enterprise typography.
 */
export function cleanEmoji(text: string): string {
  return text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}\u{2B05}-\u{2B07}\u{2934}-\u{2935}\u{2190}-\u{21FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu,
    ''
  ).trim();
}

/**
 * Extracts data source citations based on keywords in the AI response.
 */
export function extractSourceBadges(text: string): string[] {
  const badges: string[] = [];
  if (/sharepoint|contract|msa|pdf|sop|document/i.test(text)) badges.push('SharePoint');
  if (/dynamics|crm|deal|opportunity|pipeline|lead/i.test(text)) badges.push('Dynamics 365');
  if (/outlook|email|calendar|meeting|inbox/i.test(text)) badges.push('Outlook');
  if (/database|postgres|sql|revenue|order/i.test(text)) badges.push('Database');
  return badges.length > 0 ? badges : ['Unified Copilot'];
}

/**
 * Copies text to clipboard safely.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Clipboard copy error:', err);
    return false;
  }
}
