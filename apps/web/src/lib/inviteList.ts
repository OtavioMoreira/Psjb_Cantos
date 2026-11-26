// Lista colada no "Convidar vários": uma pessoa por linha, em qualquer formato comum de planilha ou e-mail:
//   Maria Souza; maria@gmail.com   ·   Maria Souza <maria@gmail.com>   ·   maria@gmail.com, Maria Souza
//   maria@gmail.com (sem nome: o nome sai do e-mail, "maria.souza" → "Maria Souza", e a pessoa ajusta no perfil)

export const BULK_INVITE_MAX = 50;

export interface InvitePerson {
  name: string;
  email: string;
  /** O nome foi tirado do e-mail (a lista não trazia). */
  guessed: boolean;
}

export interface InviteProblem {
  line: number;
  text: string;
  reason: string;
}

const EMAIL = /[^\s<>;,()"'|]+@[^\s<>;,()"'|]+\.[^\s<>;,()"'|]+/;

function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .replace(/\d+/g, " ")
    .split(/[._+\-\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function parseInviteList(text: string): { people: InvitePerson[]; problems: InviteProblem[] } {
  const people: InvitePerson[] = [];
  const problems: InviteProblem[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const found = line.match(EMAIL);
    if (!found) {
      // Cabeçalho de planilha ("Nome; E-mail") não é erro: só não é uma pessoa.
      if (!/^\W*(nome|name)\b.*\be-?mail\W*$|^\W*e-?mail\W*$/i.test(line)) problems.push({ line: i + 1, text: line, reason: "Sem e-mail." });
      return;
    }
    const email = found[0].toLowerCase().replace(/[.]+$/, "");
    const typed = line
      .replace(found[0], " ")
      .replace(/[;,\t<>()"'|]+/g, " ")
      .replace(/\s[-–—]\s/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const guessed = typed.length === 0;
    const name = guessed ? nameFromEmail(email) : typed;
    if (seen.has(email)) return problems.push({ line: i + 1, text: line, reason: "E-mail repetido na lista." });
    if (name.length < 3) return problems.push({ line: i + 1, text: line, reason: "Informe o nome (3 letras ou mais)." });
    if (name.length > 120) return problems.push({ line: i + 1, text: line, reason: "Nome longo demais." });
    seen.add(email);
    people.push({ name, email, guessed });
  });
  return { people, problems };
}
