import type { JiraTicket, PokerReadySummary } from '@/types';

const COMPLEXITY_KEYWORDS = [
  'integration', 'api', 'database', 'migration', 'refactor', 'architecture',
  'performance', 'security', 'authentication', 'authorization', 'cache',
  'async', 'concurrent', 'distributed', 'scale', 'infrastructure',
];

const RISK_KEYWORDS = [
  'legacy', 'deprecated', 'breaking change', 'no test', 'untested',
  'tech debt', 'workaround', 'hack', 'TODO', 'FIXME', 'regression',
  'production', 'critical', 'hotfix', 'rollback',
];

function extractBullets(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*•>]+/, '').trim())
    .filter((l) => l.length > 8 && l.length < 200);
  return [...new Set(lines)].slice(0, 6);
}

function detectComplexity(ticket: JiraTicket): string[] {
  const haystack = [ticket.summary, ticket.description].join(' ').toLowerCase();
  const found = COMPLEXITY_KEYWORDS.filter((kw) => haystack.includes(kw));
  const bullets: string[] = [];

  if (found.length === 0) bullets.push('Straightforward scope — limited technical complexity detected.');
  if (found.includes('integration') || found.includes('api')) bullets.push('Requires external API / integration work.');
  if (found.includes('database') || found.includes('migration')) bullets.push('Database changes or migration involved.');
  if (found.includes('refactor') || found.includes('architecture')) bullets.push('Architectural changes — may affect multiple modules.');
  if (found.includes('performance') || found.includes('scale')) bullets.push('Performance or scalability considerations present.');
  if (found.includes('security') || found.includes('authentication')) bullets.push('Security-sensitive changes require careful review.');
  if (found.includes('cache') || found.includes('async')) bullets.push('Asynchronous / caching patterns involved.');

  if (ticket.components.length > 2) bullets.push(`Touches ${ticket.components.length} components: ${ticket.components.join(', ')}.`);
  if (ticket.labels.length > 0) bullets.push(`Labels: ${ticket.labels.join(', ')}.`);

  return bullets.length ? bullets : ['Standard feature work — no specific complexity signals detected.'];
}

function detectRisks(ticket: JiraTicket): string[] {
  const haystack = [ticket.description, ticket.comments.join(' ')].join(' ').toLowerCase();
  const found = RISK_KEYWORDS.filter((kw) => haystack.includes(kw.toLowerCase()));
  const bullets: string[] = [];

  if (found.includes('legacy') || found.includes('deprecated')) bullets.push('⚠ Touches legacy or deprecated code — regression risk.');
  if (found.includes('breaking change')) bullets.push('⚠ Breaking change — downstream consumers may be affected.');
  if (found.includes('no test') || found.includes('untested')) bullets.push('⚠ Untested area — add tests before shipping.');
  if (found.includes('tech debt') || found.includes('hack') || found.includes('workaround')) bullets.push('⚠ Existing tech debt in scope — may increase actual effort.');
  if (found.includes('production') || found.includes('critical')) bullets.push('⚠ Production-critical path — extra QA recommended.');

  if (ticket.comments.length > 10) bullets.push(`ℹ High discussion volume (${ticket.comments.length} comments) — alignment may be needed.`);
  if (ticket.priority === 'Highest' || ticket.priority === 'High') bullets.push(`ℹ Priority: ${ticket.priority} — time pressure may affect estimate quality.`);

  return bullets.length ? bullets : ['No prominent risk signals detected.'];
}

function extractRequirements(ticket: JiraTicket): string[] {
  const ac = ticket.acceptanceCriteria || '';
  const bullets = extractBullets(ac);

  if (bullets.length > 0) return bullets;

  // Fall back to description paragraphs
  return extractBullets(ticket.description).slice(0, 4);
}

export function buildPokerReadySummary(ticket: JiraTicket): PokerReadySummary {
  return {
    ticketKey: ticket.key,
    title: ticket.summary,
    complexity: detectComplexity(ticket),
    risks: detectRisks(ticket),
    requirements: extractRequirements(ticket),
    rawDescription: ticket.description,
  };
}
