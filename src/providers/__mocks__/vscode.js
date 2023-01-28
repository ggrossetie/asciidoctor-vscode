/* global jest */

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
}

const OverviewRulerLane = {
  Left: null,
}

const Uri = {
  file: (f) => f,
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
