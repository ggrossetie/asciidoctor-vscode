/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode'
import { AsciidocContributions } from './asciidocExtensions'
import { AsciidocParser, AsciidoctorBuiltInBackends } from './asciidocParser'
import { Asciidoctor } from '@asciidoctor/core'

const FrontMatterRegex = /^---\s*[^]*?(-{3}|\.{3})\s*/

export class AsciidocEngine {
  private ad?: AsciidocParser

  public constructor (readonly extensionPreviewResourceProvider: AsciidocContributions, private readonly errorCollection: vscode.DiagnosticCollection = null) {
    this.extensionPreviewResourceProvider = extensionPreviewResourceProvider
    this.errorCollection = errorCollection
  }

  public getEngine (): AsciidocParser {
    // singleton
    if (!this.ad) {
      this.ad = new AsciidocParser(this.extensionPreviewResourceProvider.extensionUri, this.errorCollection)
    }

    return this.ad
  }

  public async convertPreview (documentUri: vscode.Uri, stripFrontmatter: boolean, text: string, backend: string = 'webview-html5', context: vscode.ExtensionContext, editor: vscode.WebviewPanel): Promise<{ output: string, document?: Asciidoctor.Document }> {
    if (stripFrontmatter) {
      text = this.stripFrontmatter(text).text
    }

    const textDocument = await vscode.workspace.openTextDocument(documentUri)
    return this.getEngine().convertPreview(text, textDocument, backend, context, editor)
  }

  public async export (documentUri: vscode.Uri, text: string, backend: AsciidoctorBuiltInBackends): Promise<{ output: string, document?: Asciidoctor.Document }> {
    const textDocument = await vscode.workspace.openTextDocument(documentUri)
    return this.getEngine().export(text, textDocument, backend)
  }

  private stripFrontmatter (text: string): { text: string, offset: number } {
    let offset = 0
    const frontMatterMatch = FrontMatterRegex.exec(text)
    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[0]
      offset = frontMatter.split(/\r\n|\n|\r/g).length - 1
      text = text.substr(frontMatter.length)
    }
    return { text, offset }
  }
}
