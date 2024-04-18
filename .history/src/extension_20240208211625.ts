import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

interface LineRange {
  startLine: number;
  endLine: number;
  text?: string;
}

let prevStartLine: number | null = null;
let prevEndLine: number | null = null;

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "test2.startCPExtension",
    () => {
      vscode.window.showInformationMessage("Copilot dectector started ! - 99x");
    }
  );

  let lineRange: LineRange[] = [];
  let isInProgress = false;
  let fileName = "";
  let startLine: number | null = null;

  vscode.workspace.onDidOpenTextDocument(() => {
    vscode.commands.executeCommand("test2.startCPExtension");
  });

  let disposableKeyListener = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      let document = editor.document;
      fileName = document.fileName;
      const currentLine = document.lineAt(
        editor.selection.active.line
      ).lineNumber;

      event.contentChanges.forEach((change) => {
        const text = change.text;
        const textLength = change.text.length;

        if (textLength > 2) {
          startLine = currentLine;
          isInProgress = true;
        }

        if (isInProgress === true) {
          if (startLine !== null) {
            lineRange.push({
              startLine,
              endLine: document.lineCount,
              text: text,
            });
          }

          console.log("🚀 ~ event.contentChanges.forEach ~ lineRange:", lineRange);
          isInProgress = false;
        }
      });
    }
  );

  let timeout: NodeJS.Timeout | undefined = undefined;
  vscode.window.onDidChangeTextEditorSelection(
    (event: vscode.TextEditorSelectionChangeEvent) => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      timeout = setTimeout(() => {
        console.log("User stopped typing");
        if (lineRange.length > 0 && !isInProgress) {
          let combinedLines = combineOverlappingRanges(lineRange);
          combinedLines.forEach((line, index) => {
            if (
              prevStartLine !== line.startLine ||
              prevEndLine !== line.endLine
            ) {
              if (line.text) {
                if (line.text.trim().length > 0) {
                  if (combinedLines.length === index + 1) {
                    const message = `Copilot possibly being used from line ${line.startLine} to line ${line.endLine} in file ${fileName}.`;
                    appendMessageToFile(message);
                  }

                  prevEndLine = line.endLine;
                  prevStartLine = line.startLine;
                  lineRange.splice(0, lineRange.length);
                }
              }
            }
          });
        }

        startLine = null;
      }, 1000);
    }
  );

  context.subscriptions.push(disposable, disposableKeyListener);
}

function combineOverlappingRanges(lines: LineRange[]): LineRange[] {
  lines.sort((a, b) => a.startLine - b.startLine);

  let combinedLines = [];
  let currentLine = lines[0];

  for (let i = 1; i < lines.length; i++) {
    let nextLine = lines[i];
    if (nextLine.startLine <= currentLine.endLine) {
      currentLine.endLine = Math.max(currentLine.endLine, nextLine.endLine);
      currentLine.text += "\n" + nextLine.text;
    } else {
      combinedLines.push(currentLine);
      currentLine = nextLine;
    }
  }

  combinedLines.push(currentLine);

  if (combinedLines.length === lines.length) {
    return combinedLines;
  } else {
    return combineOverlappingRanges(combinedLines);
  }
}

function appendMessageToFile(message: string) {
  const filePath = path.join(__dirname, "vscode_extension_messages.txt");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const localDateTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  const messageWithDateTime = `${localDateTimeString}: ${message}\n`;

  fs.appendFile(filePath, messageWithDateTime + "\n", (err:  NodeJS.ErrnoException | null) => {
    if (err) {
      console.error("Failed to write message to file:", err);
    }
  });
}

export function deactivate() {}