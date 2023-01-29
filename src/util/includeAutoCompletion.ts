import * as vscode from 'vscode'
import { BibtexProvider } from '../providers/bibtex.provider'
import { xrefProvider } from '../providers/xref.provider'
import { disposeAll } from '../util/dispose'

export class AsciidocFileIncludeAutoCompletionMonitor {
  private readonly disposables: vscode.Disposable[] = []
  constructor () {
    const bibtexDisposable = vscode.languages.registerCompletionItemProvider(
      {
        language: 'asciidoc',
        scheme: 'file',
      },
      BibtexProvider,
      ...[':', '/']
    )

    const xrefDisposable = vscode.languages.registerCompletionItemProvider(
      {
        language: 'asciidoc',
        scheme: 'file',
      },
      xrefProvider,
      ...[':', '/']
    )

    this.disposables.push(bibtexDisposable)
    this.disposables.push(xrefDisposable)
  }

  dispose () {
    disposeAll(this.disposables)
  }

  private readonly _onDidIncludeAutoCompletionEmitter = new vscode.EventEmitter<{
    resource: vscode.Uri;
    line: number;
  }>()

  public readonly onDidIncludeAutoCompletionEmitter = this
    ._onDidIncludeAutoCompletionEmitter.event
}
