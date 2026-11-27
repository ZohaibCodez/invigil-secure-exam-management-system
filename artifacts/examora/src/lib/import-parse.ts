export type Kind = 'questions' | 'candidates';
export interface ParsedRow {
  row: number;
  data: Record<string, unknown>;
  errors: string[];
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      cur.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cur.push(field);
      field = '';
      if (cur.some((x) => x.trim() !== '')) rows.push(cur);
      cur = [];
    } else field += c;
  }
  cur.push(field);
  if (cur.some((x) => x.trim() !== '')) rows.push(cur);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function parseInput(text: string): Record<string, unknown>[] {
  const t = text.trim();
  if (!t) return [];
  if (t.startsWith('[') || t.startsWith('{')) {
    const v = JSON.parse(t);
    const arr = Array.isArray(v) ? v : Array.isArray(v?.rows) ? v.rows : [v];
    return arr.filter((x: unknown) => x && typeof x === 'object');
  }
  return parseCsv(t);
}

function list(v: unknown): unknown[] | null {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const j = JSON.parse(s);
      return Array.isArray(j) ? j : null;
    } catch {
      return null;
    }
  }
  return s.split('|').map((x) => x.trim()).filter(Boolean);
}

const LETTERS = 'abcdefghij';

function normQuestion(raw: Record<string, unknown>): { data: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const text = String(raw.text ?? '').trim();
  const type = String(raw.type ?? '').trim().toLowerCase();
  const category = String(raw.category ?? '').trim();
  const difficulty = String(raw.difficulty ?? 'medium').trim().toLowerCase();
  const marks = Number(raw.marks);
  const explanation = String(raw.explanation ?? '').trim();
  if (text.length < 5) errors.push('text needs 5+ characters');
  if (!['single', 'multiple', 'written'].includes(type)) errors.push('type must be single, multiple or written');
  if (!category) errors.push('category is required');
  if (!['easy', 'medium', 'hard'].includes(difficulty)) errors.push('difficulty must be easy, medium or hard');
  if (!Number.isFinite(marks) || marks < 1 || marks > 1000) errors.push('marks must be 1–1000');

  let options: { id: string; text: string }[] = [];
  const ol = list(raw.options ?? '');
  if (ol === null) errors.push('options is not valid JSON or pipe text');
  else
    options = ol.map((o, i) =>
      o && typeof o === 'object' ? { id: String((o as { id?: unknown }).id ?? LETTERS[i]), text: String((o as { text?: unknown }).text ?? '').trim() } : { id: LETTERS[i] ?? `o${i}`, text: String(o).trim() },
    );
  let correct: string[] = [];
  const cl = list(raw.correctAnswers ?? raw.correct ?? '');
  if (cl === null) errors.push('correctAnswers is not valid JSON or pipe ids');
  else correct = cl.map((c) => String(c).trim());

  if (type === 'written') {
    if (options.length) errors.push('written questions take no options');
    if (correct.length) errors.push('written questions take no correct answers');
  } else if (type === 'single' || type === 'multiple') {
    if (options.length < 2) errors.push('needs at least two options');
    if (options.length > 10) errors.push('at most 10 options');
    if (options.some((o) => !o.text)) errors.push('every option needs text');
    if (new Set(options.map((o) => o.id)).size !== options.length) errors.push('option ids must be unique');
    const unknown = correct.filter((c) => !options.some((o) => o.id === c));
    if (unknown.length) errors.push(`correct id not in options: ${unknown.join(', ')}`);
    if (type === 'single' && correct.length !== 1) errors.push('single needs exactly one correct answer');
    if (type === 'multiple' && correct.length < 1) errors.push('multiple needs at least one correct answer');
  }
  return { data: { text, type, category, difficulty, marks, options, correctAnswers: correct, explanation }, errors };
}

function normCandidate(raw: Record<string, unknown>): { data: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const name = String(raw.name ?? '').trim();
  const email = String(raw.email ?? '').trim().toLowerCase();
  const password = String(raw.password ?? '');
  if (name.length < 2) errors.push('name needs 2+ characters');
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('email is invalid');
  if (password.length < 10) errors.push('password needs 10+ characters');
  return { data: { name, email, password, role: 'candidate' }, errors };
}

export function normalise(kind: Kind, rows: Record<string, unknown>[]): ParsedRow[] {
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const { data, errors } = kind === 'questions' ? normQuestion(r) : normCandidate(r);
    if (kind === 'candidates') {
      const e = String(data.email);
      if (seen.has(e)) errors.push('duplicate email in file');
      seen.add(e);
    }
    return { row: i + 1, data, errors };
  });
}

export const SAMPLES: Record<Kind, string> = {
  questions: `text,type,category,difficulty,marks,options,correctAnswers,explanation
"Which quantity is conserved in an isolated system?",single,Thermodynamics,easy,2,"Energy|Entropy|Temperature",a,"First law."
"Select every state function.",multiple,Thermodynamics,medium,3,"[{""id"":""u"",""text"":""Internal energy""},{""id"":""q"",""text"":""Heat""},{""id"":""s"",""text"":""Entropy""}]","[""u"",""s""]",
"Explain why a Carnot engine sets an upper bound on efficiency.",written,Cycles,hard,8,,,"Reversibility argument."`,
  candidates: `name,email,password
Amara Okonkwo,amara.okonkwo@uni.example,TempPass-4471
Lukas Brandt,lukas.brandt@uni.example,TempPass-8823`,
};
