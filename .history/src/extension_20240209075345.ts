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
  let disposable = vscode.commands.registerCommand("test2.startCPExtension", () => {
    vscode.window.showInformationMessage("Copilot detector started!");
  });

  let lineRange: LineRange[] = [];
  let isInProgress = false;
  let fileName = "";
  let startLine: number | null = null;

  vscode.workspace.onDidOpenTextDocument(() => {
    vscode.commands.executeCommand("test2.startCPExtension");
  });

  let disposableKeyListener = vscode.workspace.onDidChangeTextDocument(event => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    let document = editor.document;
    fileName = document.fileName;
    const currentLine = document.lineAt(editor.selection.active.line).lineNumber;

    event.contentChanges.forEach(change => {
      if (change.text.length > 2 && likelyCopilotSuggestion(change)) {
        startLine = currentLine; // Adjusted back to not add 1, to correctly capture the start line
        isInProgress = true;
      }

      if (isInProgress === true && startLine !== null) {
        lineRange.push({
          startLine,
          endLine: currentLine, // Temporarily set to currentLine, to be updated when user stops typing
          text: change.text,
        });
        isInProgress = false;
      }
    });
  });

  function likelyCopilotSuggestion(change: vscode.TextDocumentContentChangeEvent): boolean {
    return isTabPress(change);
  }

  function isTabPress(change: vscode.TextDocumentContentChangeEvent): boolean {
    return change.text.includes('\n') || change.text.length > 1;
  }

  let timeout: NodeJS.Timeout | undefined = undefined;
  vscode.window.onDidChangeTextEditorSelection(event => {
    if (timeout) {
      clearTimeout(timeout);
    }
    const currentLine = event.textEditor.selection.active.line;

    timeout = setTimeout(() => {
      console.log("User stopped typing");
      // Update the endLine of the last lineRange entry to the currentLine where the user stopped typing
      if (lineRange.length > 0) {
        lineRange[lineRange.length - 1].endLine = currentLine;
        let combinedLines = combineOverlappingRanges(lineRange);
        combinedLines.forEach((line, index) => {
          if (prevStartLine !== line.startLine || prevEndLine !== line.endLine) {
            if (line.text && line.text.trim().length > 0) {
              const message = `Copilot possibly being used from line ${line.startLine} to line ${line.endLine} in file ${fileName}.`;
              appendMessageToFile(message);

              prevEndLine = line.endLine;
              prevStartLine = line.startLine;
            }
          }
        });
        lineRange.splice(0, lineRange.length); // Clear the lineRange after processing
      }
      startLine = null;
    }, 1000);
  });

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
  return combinedLines.length === lines.length ? combinedLines : combineOverlappingRanges(combinedLines);
}

function appendMessageToFile(message: string) {
  const filePath = path.join(__dirname, "vscode_extension_messages.txt");
  fs.appendFile(filePath, message + "\n", err => {
    if (err) {
      console.error("Failed to write message to file:", err);
    }
  });
}

export function deactivate() {}
