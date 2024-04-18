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

  let isAcceptingCompletion = false;
  // Example command registration (theoretical, specific to your setup)
  context.subscriptions.push(vscode.commands.registerCommand('your.extension.acceptCompletion', () => {
    isAcceptingCompletion = true;
  }));

  let isAcceptingCompletion = false; // Make sure this flag is defined in a scope accessible by your event handlers

  let disposableKeyListener = vscode.workspace.onDidChangeTextDocument(event => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isAcceptingCompletion) return; // Early return if no active editor or flag is not set
  
    let document = editor.document;
    fileName = document.fileName;
    const initialLine = document.lineAt(editor.selection.start.line).lineNumber;
  
    event.contentChanges.forEach(change => {
      if (likelyCopilotSuggestion(change)) {
        let changeStartLine = editor.document.positionAt(change.rangeOffset).line;
        let newLines = (change.text.match(/\n/g) || []).length;
        let changeEndLine = changeStartLine + newLines;
  
        startLine = changeStartLine + 1; // Adjust for 1-based indexing
        let endLine = Math.max(changeEndLine, changeStartLine) + 1; // Ensure at least 1 line difference
  
        lineRange.push({
          startLine: startLine,
          endLine: endLine,
          text: change.text,
        });
      }
    });
  
    isAcceptingCompletion = false; // Reset the flag after processing the change
  });
  
  context.subscriptions.push(disposableKeyListener);
  
  

 /* function likelyCopilotSuggestion(change: vscode.TextDocumentContentChangeEvent): boolean {
    // Heuristic: Check if the change could be from an auto-completion
    // This is a very basic check and might not be fully accurate
    return change.text.startsWith('    ') || // Checks if the text starts with an indentation (example uses 4 spaces)
           (change.text.length > 1 && !change.text.includes('\n')); // Checks for multi-character insertions without new lines
  }
  */

  function likelyCopilotSuggestion(change: vscode.TextDocumentContentChangeEvent): boolean {
    // Advanced heuristic example: Look for patterns that are more specific to auto-completions
    const hasKeywordPattern = /\b(function|class|const|let|var)\b/.test(change.text);
    const endsWithSemicolonOrBrace = /[;}]\s*$/.test(change.text);
    const significantInsertion = change.text.length > 3 && !change.text.includes('\n');
  
    return hasKeywordPattern || endsWithSemicolonOrBrace || significantInsertion;
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
    if (lineRange.length > 0) {
      let combinedLines = combineOverlappingRanges(lineRange);
      const editor = vscode.window.activeTextEditor;
      if (editor) { // Make sure there is an active editor
        const document = editor.document;
        const totalLines = document.lineCount; // Correct place to calculate the total number of lines

        combinedLines.forEach((line) => {
          // Ensure endLine is at least equal to startLine
          if (line.endLine < line.startLine) {
            line.endLine = line.startLine;
          }
          
          // The difference calculation here accounts for 1-based indexing inherently due to previous adjustments
          const diff = line.endLine - line.startLine; // No need for additional +1 here, as start and end lines have been adjusted
          
          const totalLinesMessage = `Total lines in file: ${totalLines}. Difference between start and end lines: ${diff}.`;
          const message = `Copilot possibly being used from line ${line.startLine} to line ${line.endLine} in file ${fileName}. ${totalLinesMessage}`;
          
          if (line.text && line.text.trim().length > 0) {
            appendMessageToFile(message);
        
            prevEndLine = line.endLine;
            prevStartLine = line.startLine;
          }
        });
        
        lineRange.splice(0, lineRange.length); // Clear the lineRange after processing
      }
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
