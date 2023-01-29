/* global jest */

const { URI } = require('vscode-uri')

const languages = {
  createDiagnosticCollection: jest.fn(),
}

const StatusBarAlignment = {}

const window = {
  createStatusBarItem: jest.fn(() => ({
    show: jest.fn(),
  })),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  createTextEditorDecorationType: jest.fn(),
}

const workspace = {
  getConfiguration: jest.fn(),
  workspaceFolders: [],
  onDidSaveTextDocument: jest.fn(),
  fs: {
    readDirectory: jest.fn(),
  },
}

const FileType = {
  /**
   * The file type is unknown.
   */
  Unknown: 0,
  /**
   * A regular file.
   */
  File: 1,
  /**
   * A directory.
   */
  Directory: 2,
  /**
   * A symbolic link to a file.
   */
  SymbolicLink: 64,
}

const CompletionItemKind = {
  Text: 0,
  Method: 1,
  Function: 2,
  Constructor: 3,
  Field: 4,
  Variable: 5,
  Class: 6,
  Interface: 7,
  Module: 8,
  Property: 9,
  Unit: 10,
  Value: 11,
  Enum: 12,
  Keyword: 13,
  Snippet: 14,
  Color: 15,
  Reference: 17,
  File: 16,
  Folder: 18,
  EnumMember: 19,
  Constant: 20,
  Struct: 21,
  Event: 22,
  Operator: 23,
  TypeParameter: 24,
  User: 25,
  Issue: 26,
}

const CompletionTriggerKind = {
  /**
   * Completion was triggered normally.
   */
  Invoke: 0,
  /**
   * Completion was triggered by a trigger character.
   */
  TriggerCharacter: 1,
  /**
   * Completion was re-triggered as current completion list is incomplete
   */
  TriggerForIncompleteCompletions: 2
}

const CompletionContext = {
  /**
   * How the completion was triggered.
   */
  triggerKind: CompletionTriggerKind,

  /**
   * Character that triggered the completion item provider.
   *
   * `undefined` if the provider was not triggered by a character.
   *
   * The trigger character is already in the document when the completion provider is triggered.
   */
  triggerCharacter: String | undefined,
}

const OverviewRulerLane = {
  Left: null,
}

const Uri = {
  file: (f) => URI.parse(f),
  parse: jest.fn(),
}

class Range {
  constructor (startLine, startCharacter, endLine, endCharacter) {
    this.startLine = startLine
    this.startCharacter = startCharacter
    this.endLine = endLine
    this.endCharacter = endCharacter
  }
}

class Position {
  constructor (line, character) {
    this.line = line
    this.character = character
  }

  with (args) {
    if ('line' in args) {
      this.line = args.line
    }
    if ('character' in args) {
      this.character = args.character
    }
  }
}

const Diagnostic = jest.fn()
const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
}

const debug = {
  onDidTerminateDebugSession: jest.fn(),
  startDebugging: jest.fn(),
}

const commands = {
  executeCommand: jest.fn(),
}

const vscode = {
  languages,
  StatusBarAlignment,
  window,
  workspace,
  FileType,
  CompletionItemKind,
  CompletionContext,
  CompletionTriggerKind,
  OverviewRulerLane,
  Uri,
  Range,
  Diagnostic,
  DiagnosticSeverity,
  debug,
  commands,
  Position,
}

module.exports = vscode
