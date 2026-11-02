import * as vscode from 'vscode';
import { filterTodos, parseTodos, summarizeTodos, TodoItem, TodoKind } from './parser';

/** Элемент стандартного списка VS Code со ссылкой на исходную заметку. */
interface NoteQuickPickItem extends vscode.QuickPickItem {
  note: TodoItem;
}

/**
 * Активирует расширение и регистрирует три команды навигации.
 * VS Code вызывает функцию при первом запуске одной из команд расширения.
 * Регистрации освобождаются через context.subscriptions.
 * @example activate(context) // вызывается средой VS Code
 */
export function activate(context: vscode.ExtensionContext): void {
  const commands: Array<{ id: string; kind?: TodoKind }> = [
    { id: 'todoNavigator.showAll' },
    { id: 'todoNavigator.showTodo', kind: 'TODO' },
    { id: 'todoNavigator.showFixme', kind: 'FIXME' }
  ];

  for (const command of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command.id, () => showNotes(command.kind))
    );
  }
}

/**
 * Анализирует активный документ, показывает список и выполняет переход.
 * При отсутствии редактора или заметок выводит понятное сообщение.
 * Отмена списка оставляет курсор на прежнем месте.
 * @example showNotes('FIXME') // показать только заметки об ошибках
 */
async function showNotes(kind?: TodoKind): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showInformationMessage('TODO Navigator: сначала откройте текстовый файл.');
    return;
  }

  const document = editor.document;
  const version = document.version;
  const allNotes = parseTodos(document.getText());
  const notes = filterTodos(allNotes, kind);

  if (notes.length === 0) {
    const label = kind ?? 'TODO/FIXME';
    void vscode.window.showInformationMessage(`TODO Navigator: заметки ${label} не найдены.`);
    return;
  }

  const counts = summarizeTodos(allNotes);
  const items: NoteQuickPickItem[] = notes.map((note) => ({
    label: `${note.kind}: ${note.text || '(без описания)'}`,
    description: `Строка ${note.line + 1}`,
    note
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: `TODO Navigator — TODO: ${counts.TODO}, FIXME: ${counts.FIXME}`,
    placeHolder: 'Введите текст заметки или номер строки',
    matchOnDescription: true
  });

  if (!selected) {
    return;
  }

  if (document.isClosed || document.version !== version) {
    void vscode.window.showInformationMessage(
      'TODO Navigator: файл изменён или закрыт. Запустите поиск повторно.'
    );
    return;
  }

  // Открываем исходный документ, даже если пользователь переключил вкладку.
  const targetEditor = await vscode.window.showTextDocument(document);
  const position = new vscode.Position(selected.note.line, selected.note.column);
  targetEditor.selection = new vscode.Selection(position, position);
  targetEditor.revealRange(
    new vscode.Range(position, position),
    vscode.TextEditorRevealType.InCenterIfOutsideViewport
  );
}
