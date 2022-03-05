import * as vscode from 'vscode'
import * as path from 'path'
import { spawn } from 'child_process'
import { AsciidoctorWebViewConverter } from './asciidoctorWebViewConverter'
import { Asciidoctor } from '@asciidoctor/core'
import { IncludeItems } from './asciidoctorFindIncludeProcessor'
import { SkinnyTextDocument } from './util/document'

const asciidoctorFindIncludeProcessor = require('./asciidoctorFindIncludeProcessor')

const asciidoctor = require('@asciidoctor/core')
const docbookConverter = require('@asciidoctor/docbook-converter')
const kroki = require('asciidoctor-kroki')
const processor = asciidoctor()
const highlightjsBuiltInSyntaxHighlighter = processor.SyntaxHighlighter.for('highlight.js')
const highlightjsAdapter = require('./highlightjs-adapter')
docbookConverter.register()

export type AsciidoctorBuiltInBackends = 'html5' | 'docbook5' | 'docbook45'

export class AsciidocParser {
  private stylesdir: string

  constructor (extensionUri: vscode.Uri, private errorCollection: vscode.DiagnosticCollection = null) {
    // Asciidoctor.js in the browser environment works with URIs however for desktop clients
    // the stylesdir attribute is expected to look like a file system path (especially on Windows)
    if (process.env.BROWSER_ENV) {
      this.stylesdir = vscode.Uri.joinPath(extensionUri, 'media').toString()
    } else {
      this.stylesdir = vscode.Uri.joinPath(extensionUri, 'media').fsPath
    }
  }

  public getMediaDir (text) {
    return text.match(/^\\s*:mediadir:/)
  }

  // Export

  public async export (text: string, doc: vscode.TextDocument, backend: AsciidoctorBuiltInBackends): Promise<{ output: string, document?: Asciidoctor.Document }> {
    const asciidocConfig = vscode.workspace.getConfiguration('asciidoc', null)
    const useAsciidoctorJs = asciidocConfig.get('use_asciidoctor_js')
    if (useAsciidoctorJs) {
      return this.exportUsingJavascript(text, doc, backend)
    }
    const output = await this.exportUsingCli(text, doc, backend)
    return { output }
  }

  private async exportUsingCli (text: string, textDocument: vscode.TextDocument, backend: AsciidoctorBuiltInBackends): Promise<string> {
    const asciidocConfig = vscode.workspace.getConfiguration('asciidoc', null)
    const asciidoctorCommand = asciidocConfig.get('asciidoctor_command', 'asciidoctor')
    const adocCmdArray = asciidoctorCommand.split(/(\s+)/).filter(function (e) {
      return e.trim().length > 0
    })
    const baseDir = this.getBaseDir(textDocument)
    const baseDirArgValue = `"${baseDir.replace('"', '\\"')}"`
    const adocCmd = adocCmdArray[0]
    const adocCmdArgs = adocCmdArray.slice(1)
    adocCmdArgs.push('-b', backend)
    adocCmdArgs.push('-a', 'env-vscode')
    adocCmdArgs.push('-q', '-B', baseDirArgValue, '-o', '-', '-')
    const documentPath = path.dirname(path.resolve(textDocument.fileName))
    return this.spawAsciidoctorCli(adocCmd, adocCmdArgs, text, documentPath)
  }

  private exportUsingJavascript (text: string, textDocument: vscode.TextDocument, backend: AsciidoctorBuiltInBackends): { output: string, document: Asciidoctor.Document } {
    const asciidocConfig = vscode.workspace.getConfiguration('asciidoc', null)
    if (this.errorCollection) {
      this.errorCollection.clear()
    }
    const memoryLogger = processor.MemoryLogger.create()
    processor.LoggerManager.setLogger(memoryLogger)
    const registry = processor.Extensions.create()
    const useKroki = asciidocConfig.get('use_kroki')
    if (useKroki) {
      kroki.register(registry)
    }
    highlightjsBuiltInSyntaxHighlighter.$register_for('highlight.js', 'highlightjs')
    const baseDir = this.getBaseDir(textDocument)
    const options: { [key: string]: any } = {
      attributes: {
        'env-vscode': '',
      },
      backend,
      base_dir: baseDir,
      extension_registry: registry,
      header_footer: true,
      safe: 'unsafe',
    }
    const document = processor.load(text, options)
    const output = document.convert(options)
    if (asciidocConfig.get('enableErrorDiagnostics')) {
      this.reportErrors(memoryLogger, textDocument)
    }
    return { output, document }
  }

  // Convert (preview)

  public async convertPreview (text: string, textDocument: vscode.TextDocument, backend: string = 'webview-html5', context?: vscode.ExtensionContext, editor?: vscode.WebviewPanel): Promise<{ output: string, document?: Asciidoctor.Document }> {
    const useAsciidoctorJs = vscode.workspace.getConfiguration('asciidoc', null).get('use_asciidoctor_js')
    if (useAsciidoctorJs) {
      return this.convertUsingJavascript(text, textDocument, backend, context, editor)
    }

    // AsciidoctorWebViewConverter is not available in asciidoctor (Ruby) CLI
    const output = await this.convertUsingApplication(text, textDocument, backend === 'webview-html5' ? 'html5' : backend)
    return { output }
  }

  public convertUsingJavascript (
    text: string,
    textDocument: vscode.TextDocument,
    backend: string,
    context: vscode.ExtensionContext,
    editor: vscode.WebviewPanel
  ): { output: string, document: Asciidoctor.Document } {
    const workspacePath = vscode.workspace.workspaceFolders
    const asciidocConfig = vscode.workspace.getConfiguration('asciidoc', null)
    const useEditorStylesheet = asciidocConfig.get('preview.useEditorStyle', false)
    const previewAttributes = asciidocConfig.get('preview.attributes', {})
    const previewStyle = asciidocConfig.get('preview.style', '')

    if (this.errorCollection) {
      this.errorCollection.clear()
    }

    const memoryLogger = processor.MemoryLogger.create()
    processor.LoggerManager.setLogger(memoryLogger)
    const asciidoctorWebViewConverter = new AsciidoctorWebViewConverter()
    processor.ConverterFactory.register(asciidoctorWebViewConverter, ['webview-html5'])
    const registry = processor.Extensions.create()
    const useKroki = asciidocConfig.get('use_kroki')
    if (useKroki) {
      kroki.register(registry)
    }

    highlightjsAdapter.register(highlightjsBuiltInSyntaxHighlighter, context, editor)

    let attributes = {}

    const containsStyle = !(text.match(/'^\\s*:(stylesheet|stylesdir)/img) == null)
    if (containsStyle) {
      attributes = { copycss: true }
    } else if (previewStyle !== '') {
      let stylesdir: string, stylesheet: string

      if (path.isAbsolute(previewStyle)) {
        stylesdir = path.dirname(previewStyle)
        stylesheet = path.basename(previewStyle)
      } else {
        if (workspacePath === undefined) {
          stylesdir = ''
        } else if (workspacePath.length > 0) {
          stylesdir = workspacePath[0].uri.path
        }

        stylesdir = path.dirname(path.join(stylesdir, previewStyle))
        stylesheet = path.basename(previewStyle)
      }

      attributes = {
        copycss: true,
        stylesdir: stylesdir,
        stylesheet: stylesheet,
      }
    } else if (useEditorStylesheet) {
      attributes = {
        'allow-uri-read': true,
        copycss: false,
        stylesdir: this.stylesdir,
        stylesheet: 'asciidoctor-editor.css',
      }
    } else {
      // TODO: decide whether to use the included css or let ascidoctor.js decide
      // attributes = { 'copycss': true, 'stylesdir': this.stylesdir, 'stylesheet': 'asciidoctor-default.css@' }
    }

    // TODO: Check -- Not clear that this code is functional
    Object.keys(previewAttributes).forEach((key) => {
      if (typeof previewAttributes[key] === 'string') {
        attributes[key] = previewAttributes[key]
        if (workspacePath !== undefined) {
          // eslint-disable-next-line no-template-curly-in-string
          attributes[key] = attributes[key].replace('${workspaceFolder}', workspacePath[0].uri.path)
        }
      }
    })

    attributes['env-vscode'] = ''
    const baseDir = this.getBaseDir(textDocument)
    const options: { [key: string]: any } = {
      attributes: attributes,
      backend: backend,
      base_dir: baseDir,
      extension_registry: registry,
      header_footer: true,
      safe: 'unsafe',
      sourcemap: true,
    }

    try {
      const document = processor.load(text, options)
      const blocksWithLineNumber = document.findBy(function (b) {
        return typeof b.getLineNumber() !== 'undefined'
      })
      blocksWithLineNumber.forEach(function (block) {
        block.addRole('data-line-' + block.getLineNumber())
      })
      const output = document.convert(options)
      const enableErrorDiagnostics = asciidocConfig.get('enableErrorDiagnostics')
      if (enableErrorDiagnostics) {
        this.reportErrors(memoryLogger, textDocument)
      }
      return { output, document }
    } catch (e) {
      vscode.window.showErrorMessage(e.toString())
      throw e
    }
  }

  private async convertUsingApplication (text: string, doc: vscode.TextDocument, backend: string): Promise<string> {
    const documentPath = path.dirname(path.resolve(doc.fileName))
    const workspacePath = vscode.workspace.workspaceFolders
    const asciidocConfig = vscode.workspace.getConfiguration('asciidoc', null)
    const useEditorStylesheet = asciidocConfig.get('preview.useEditorStyle', false)
    const previewAttributes = asciidocConfig.get('preview.attributes', {})
    const previewStyle = asciidocConfig.get('preview.style', '')
    const asciidoctorCommand = asciidocConfig.get('asciidoctor_command', 'asciidoctor')
    const adocCmdArray = asciidoctorCommand.split(/(\s+)/).filter(function (e) {
      return e.trim().length > 0
    })
    const adocCmd = adocCmdArray[0]
    const adocCmdArgs = adocCmdArray.slice(1)
    // TODO: we should probably remove this condition since the regular expression is "invalid".
    // the expression must start with a single quote but also start with 0 or more spaces followed by : (which is impossible!).
    const containsStyle = !(text.match(/'^\\s*:(stylesheet|stylesdir):/img) == null)
    if (containsStyle) {
      ; // Used an empty if to make it easier to use elses later
    } else if (previewStyle !== '') {
      let stylesdir: string, stylesheet: string
      if (path.isAbsolute(previewStyle)) {
        stylesdir = path.dirname(previewStyle)
        stylesheet = path.basename(previewStyle)
      } else {
        if (workspacePath === undefined) {
          stylesdir = documentPath
        } else if (workspacePath.length > 0) {
          stylesdir = workspacePath[0].uri.path
        }
        stylesdir = path.dirname(path.join(stylesdir, previewStyle))
        stylesheet = path.basename(previewStyle)
      }
      adocCmdArgs.push('-a', `stylesdir=${stylesdir}`)
      adocCmdArgs.push('-a', `stylesheet=${stylesheet}`)
    } else if (useEditorStylesheet) {
      adocCmdArgs.push('-a', `stylesdir=${this.stylesdir}@`)
      adocCmdArgs.push('-a', 'stylesheet=asciidoctor-editor.css@')
    } else {
      // TODO: decide whether to use the included css or let ascidoctor decide
      // adoc_cmd_args.push.apply(adoc_cmd_args, ['-a', `stylesdir=${this.stylesdir}@`])
      // adoc_cmd_args.push.apply(adoc_cmd_args, ['-a', 'stylesheet=asciidoctor-default.css@'])
    }
    adocCmdArgs.push('-b', backend)
    Object.keys(previewAttributes).forEach((key) => {
      if (typeof previewAttributes[key] === 'string') {
        let value: string = previewAttributes[key]
        if (workspacePath !== undefined) {
          // eslint-disable-next-line no-template-curly-in-string
          value = value.replace('${workspaceFolder}', workspacePath[0].uri.path)
        }

        if (value.endsWith('!')) {
          adocCmdArgs.push('-a', `${value}`)
        } else {
          adocCmdArgs.push('-a', `${key}=${value}`)
        }
      }
    })
    adocCmdArgs.push('-a', 'env-vscode')
    const baseDir = this.getBaseDir(doc)
    const baseDirArgValue = `"${baseDir.replace('"', '\\"')}"`
    adocCmdArgs.push('-q', '-B', baseDirArgValue, '-o', '-', '-')
    return this.spawAsciidoctorCli(adocCmd, adocCmdArgs, text, documentPath)
  }

  // Load

  public load (textDocument: SkinnyTextDocument): { document: Asciidoctor.Document, baseDocumentIncludeItems: IncludeItems } {
    const memoryLogger = processor.MemoryLogger.create()
    processor.LoggerManager.setLogger(memoryLogger)
    const registry = processor.Extensions.create()
    asciidoctorFindIncludeProcessor.register(registry)
    asciidoctorFindIncludeProcessor.resetIncludes()
    const baseDir = this.getBaseDir(textDocument)
    const document = processor.load(textDocument.getText(), {
      attributes: {
        'env-vscode': '',
      },
      base_dir: baseDir,
      extension_registry: registry,
      sourcemap: true,
      safe: 'unsafe',
    })
    // QUESTION: should we report error?
    return { document, baseDocumentIncludeItems: asciidoctorFindIncludeProcessor.getBaseDocIncludes() }
  }

  private reportErrors (memoryLogger: Asciidoctor.MemoryLogger, doc: vscode.TextDocument) {
    const diagnostics = []
    memoryLogger.getMessages().forEach((error) => {
      //console.log(error); //Error from asciidoctor.js
      let errorMessage = error.getText()
      let sourceLine = 0
      let relatedFile = null
      const diagnosticSource = 'asciidoctor.js'
      // allocate to line 0 in the absence of information
      let sourceRange = doc.lineAt(0).range
      const location = error.getSourceLocation()
      if (location) { //There is a source location
        if (location.getPath() === '<stdin>') { //error is within the file we are parsing
          sourceLine = location.getLineNumber() - 1
          // ensure errors are always associated with a valid line
          sourceLine = sourceLine >= doc.lineCount ? doc.lineCount - 1 : sourceLine
          sourceRange = doc.lineAt(sourceLine).range
        } else { //error is coming from an included file
          relatedFile = error.getSourceLocation()
          // try to find the include responsible from the info provided by asciidoctor.js
          sourceLine = doc.getText().split('\n').indexOf(doc.getText().split('\n').find((str) => str.startsWith('include') && str.includes(relatedFile.path)))
          if (sourceLine !== -1) {
            sourceRange = doc.lineAt(sourceLine).range
          }
        }
      } else {
        // generic error (e.g. :source-highlighter: coderay)
        errorMessage = error.message
      }
      let severity = vscode.DiagnosticSeverity.Information
      if (error.getSeverity() === 'WARN') {
        severity = vscode.DiagnosticSeverity.Warning
      } else if (error.getSeverity() === 'ERROR') {
        severity = vscode.DiagnosticSeverity.Error
      } else if (error.getSeverity() === 'DEBUG') {
        severity = vscode.DiagnosticSeverity.Information
      }
      let diagnosticRelated = null
      if (relatedFile) {
        diagnosticRelated = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(vscode.Uri.file(relatedFile.file),
              new vscode.Position(0, 0)
            ),
            errorMessage
          ),
        ]
        errorMessage = 'There was an error in an included file'
      }
      const diagnosticError = new vscode.Diagnostic(sourceRange, errorMessage, severity)
      diagnosticError.source = diagnosticSource
      if (diagnosticRelated) {
        diagnosticError.relatedInformation = diagnosticRelated
      }
      diagnostics.push(diagnosticError)
    })
    if (this.errorCollection) {
      this.errorCollection.set(doc.uri, diagnostics)
    }
  }

  private async spawAsciidoctorCli (asciidoctorCliCommand, asciidoctorCliArgs, inputText, cwd): Promise<string> {
    const RUBYOPT = this.getRubyOpts()
    return new Promise((resolve, reject) => {
      const asciidoctorProcess = spawn(asciidoctorCliCommand, asciidoctorCliArgs, {
        shell: true,
        cwd,
        env: { ...process.env, RUBYOPT },
      })
      asciidoctorProcess.stderr.on('data', (data) => {
        let errorMessage = data.toString()
        console.error(errorMessage)
        errorMessage += errorMessage.replace('\n', '<br><br>')
        errorMessage += '<br><br>'
        errorMessage += '<b>command:</b> ' + asciidoctorCliCommand + ' ' + asciidoctorCliArgs.join(' ')
        errorMessage += '<br><br>'
        errorMessage += '<b>If the asciidoctor binary is not in your PATH, you can set the full path.<br>'
        errorMessage += 'Go to `File -> Preferences -> User settings` and adjust the asciidoc.asciidoctor_command</b>'
        reject(new Error(errorMessage))
      })
      let resultData = Buffer.from('')
      /* with large outputs we can receive multiple calls */
      asciidoctorProcess.stdout.on('data', (data) => {
        resultData = Buffer.concat([resultData, data as Buffer])
      })
      asciidoctorProcess.on('close', () => {
        resolve(resultData.toString())
      })
      asciidoctorProcess.stdin.write(inputText)
      asciidoctorProcess.stdin.end()
    })
  }

  /**
   * Get the base directory.
   * @param textDocument
   * @private
   */
  private getBaseDir (textDocument: SkinnyTextDocument): string {
    const asciidocConfig = vscode.workspace.getConfiguration('asciidoc', null)
    const useWorkspaceAsBaseDir = asciidocConfig.get('useWorkspaceRoot')
    const documentPath = process.env.BROWSER_ENV
      ? undefined
      : path.dirname(path.resolve(textDocument.fileName))
    return useWorkspaceAsBaseDir && typeof vscode.workspace.rootPath !== 'undefined'
      ? vscode.workspace.rootPath
      : documentPath
  }

  /**
   * Get RUBYOPTS.
   * @private
   */
  private getRubyOpts () {
    const RUBYOPT = process.env.RUBYOPT
    if (RUBYOPT) {
      let prevOpt
      return RUBYOPT.split(' ').reduce((acc, opt) => {
        acc.push(prevOpt === '-E' ? (prevOpt = 'UTF-8:UTF-8') : (prevOpt = opt))
        return acc
      }, []).join(' ')
    }
    return '-E UTF-8:UTF-8'
  }
}
