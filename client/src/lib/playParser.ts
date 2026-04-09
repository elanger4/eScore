/**
 * Encodes and decodes at-bat result codes.
 *
 * result_code grammar:
 *   simple: HR | 1B | 2B | 3B | K | KL | BB | IBB | HBP | SAC | SF | E{pos}
 *   fielded: GO:{pos[-pos]*} | FO:{pos} | LO:{pos} | GDP:{pos[-pos]*} | LDP:{pos[-pos]*} | FC:{pos}
 *   SF with fielder: SF:{pos}
 *
 * Display text examples:
 *   HR → "HR"
 *   GO:6-3 → "6-3"
 *   FO:8 → "F8"
 *   LO:6 → "L6"
 *   GDP:6-4-3 → "6-4-3 DP"
 *   LDP:3-6 → "3-6 LDP"
 *   FC:6 → "FC (6)"
 *   SF:8 → "SF (8)"
 *   E6 → "E6"
 */

export function displayText(resultCode: string): string {
  if (!resultCode) return '';

  if (resultCode.startsWith('GO:')) {
    return resultCode.replace('GO:', '');
  }
  if (resultCode.startsWith('FO:')) {
    return 'F' + resultCode.replace('FO:', '');
  }
  if (resultCode.startsWith('LO:')) {
    return 'L' + resultCode.replace('LO:', '');
  }
  if (resultCode.startsWith('GDP:')) {
    return resultCode.replace('GDP:', '') + ' DP';
  }
  if (resultCode.startsWith('LDP:')) {
    return resultCode.replace('LDP:', '') + ' LDP';
  }
  if (resultCode.startsWith('FC:')) {
    return 'FC (' + resultCode.replace('FC:', '') + ')';
  }
  if (resultCode.startsWith('SF:')) {
    return 'SF (' + resultCode.replace('SF:', '') + ')';
  }
  if (resultCode === 'KL') return 'K (looking)';
  if (resultCode === 'IBB') return 'IBB';
  if (resultCode === 'SAC') return 'SAC bunt';

  return resultCode;
}

/** Returns how many outs a play results in (batter's PA only, not DPs) */
export function outsOnPlay(resultCode: string): number {
  if (!resultCode) return 0;
  if (['HR', '1B', '2B', '3B', 'BB', 'IBB', 'HBP'].includes(resultCode)) return 0;
  if (resultCode.startsWith('GDP:') || resultCode.startsWith('LDP:')) return 2;
  if (resultCode.startsWith('SF:') || resultCode === 'SF') return 1; // batter out on sac fly
  if (['K', 'KL', 'GO', 'FO', 'LO', 'SAC', 'FC'].some(p => resultCode === p || resultCode.startsWith(p + ':'))) return 1;
  if (resultCode.startsWith('E')) return 0; // batter reaches
  return 0;
}

export function isHit(resultCode: string): boolean {
  return ['1B', '2B', '3B', 'HR'].includes(resultCode);
}

export function isOut(resultCode: string): boolean {
  return outsOnPlay(resultCode) > 0;
}

export function isNonAB(resultCode: string): boolean {
  return ['BB', 'IBB', 'HBP', 'SAC'].includes(resultCode) || resultCode.startsWith('SF');
}

/** Parse fielder positions from a fielded code like "GDP:6-4-3" → [6, 4, 3] */
export function parseFielders(resultCode: string): number[] {
  const parts = resultCode.split(':');
  if (parts.length < 2) return [];
  return parts[1].split('-').map(Number);
}

/** Build a mid-PA event result code */
export function buildMidPACode(
  type: 'sb' | 'cs' | 'po' | 'wp' | 'pb' | 'bk',
  base: string,
  runnerId: number,
  fielders?: string,
): string {
  const t = `mid_pa_${type}`;
  if (type === 'cs') return `CS:${base}:${runnerId}:${fielders ?? ''}`;
  if (type === 'sb') return `SB:${base}:${runnerId}`;
  if (type === 'po') return `PO:${base}:${runnerId}`;
  if (type === 'wp') return `WP:${runnerId}:${base}`;
  if (type === 'pb') return `PB:${runnerId}:${base}`;
  if (type === 'bk') return `BK:${runnerId}:${base}`;
  return '';
}

export function displayMidPAText(playType: string, resultCode: string): string {
  if (playType === 'mid_pa_sb') {
    const parts = resultCode.split(':');
    return `SB (${ordinalBase(parts[1])})`;
  }
  if (playType === 'mid_pa_cs') {
    const parts = resultCode.split(':');
    return `CS (${ordinalBase(parts[1])}) — ${parts[3] ?? ''}`;
  }
  if (playType === 'mid_pa_po') {
    const parts = resultCode.split(':');
    return `PO (${ordinalBase(parts[1])})`;
  }
  if (playType === 'mid_pa_wp') return 'WP';
  if (playType === 'mid_pa_pb') return 'PB';
  if (playType === 'mid_pa_bk') return 'BK';
  return playType;
}

function ordinalBase(base: string): string {
  if (base === '1') return '1st';
  if (base === '2') return '2nd';
  if (base === '3') return '3rd';
  if (base === 'H') return 'home';
  return base;
}
