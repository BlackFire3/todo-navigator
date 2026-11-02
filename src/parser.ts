/** Поддерживаемые типы заметок. */
export type TodoKind = 'TODO' | 'FIXME';

/** Заметка. Строка и столбец отсчитываются от нуля, как в API VS Code. */
export interface TodoItem {
  kind: TodoKind;
  text: string;
  line: number;
  column: number;
}

/**
 * Находит заметки на отдельной строке или в комментарии после кода.
 * Поддерживает //, #, /* и *, а также строки без префикса.
 * Двоеточие после метки обязательно; на строке распознаётся одна заметка.
 *
 * @param text Полный текст документа, включая несохранённые изменения.
 * @returns Заметки в порядке расположения в документе.
 * @example parseTodos('// TODO: добавить проверку')[0].text // 'добавить проверку'
 */
export function parseTodos(text: string): TodoItem[] {
  const result: TodoItem[] = [];
  const lines = text.split(/\r\n|\r|\n/);
  const pattern = /^(\s*(?:\/\/|#|\/\*+|\*)?\s*)(TODO|FIXME)\s*:\s*(.*)$/i;

  for (let line = 0; line < lines.length; line += 1) {
    let start = 0;
    let match = pattern.exec(lines[line]);
    if (!match) {
      start = findCommentStart(lines[line]);
      if (start < 0) {
        continue;
      }
      match = pattern.exec(lines[line].slice(start));
    }
    if (!match) {
      continue;
    }

    const prefix = match[1];
    // Текст после закрытия блочного комментария не относится к заметке.
    const description = /\/\*|\*/.test(prefix)
      ? match[3].split('*/', 1)[0]
      : match[3];

    result.push({
      kind: match[2].toUpperCase() as TodoKind,
      text: description.trim(),
      line,
      column: start + prefix.length
    });
  }

  return result;
}

/**
 * Возвращает позицию первого комментария вне обычных строковых литералов.
 * Пропускает одинарные, двойные и обратные кавычки, учитывая экранирование.
 * Это построчная проверка, а не полноценный синтаксический анализ языка.
 * @example findCommentStart('return 1; // TODO: проверка') // 10
 */
function findCommentStart(line: string): number {
  let quote: string | undefined;
  for (let column = 0; column < line.length; column += 1) {
    const character = line[column];
    if (quote) {
      if (character === '\\') {
        column += 1;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '#' || (character === '/' && ['/', '*'].includes(line[column + 1]))) {
      return column;
    }
  }
  return -1;
}

/**
 * Возвращает заметки выбранного типа, сохраняя исходный массив и порядок.
 * Без типа возвращает копию массива со всеми заметками.
 * @example filterTodos(parseTodos('// FIXME: ошибка'), 'TODO') // []
 */
export function filterTodos(items: readonly TodoItem[], kind?: TodoKind): TodoItem[] {
  return kind ? items.filter((item) => item.kind === kind) : [...items];
}

/**
 * Подсчитывает заметки каждого типа, в том числе при пустом списке.
 * @example summarizeTodos([]) // { TODO: 0, FIXME: 0 }
 */
export function summarizeTodos(items: readonly TodoItem[]): Record<TodoKind, number> {
  const counts: Record<TodoKind, number> = { TODO: 0, FIXME: 0 };
  for (const item of items) {
    counts[item.kind] += 1;
  }
  return counts;
}
