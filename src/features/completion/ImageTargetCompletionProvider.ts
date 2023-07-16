import * as vscode from 'vscode'
import { posix } from 'path'
import { AsciidocLoader } from '../../asciidocLoader'
import { imageFileExtensions } from '../dropIntoEditor'

const imageMacroRx = /(?<=\s|^)image::?/gm
const attributeReferenceRx = /(\\+)?\{([\p{Ll}0-9_][\p{Ll}0-9_-]*)\}/gu

export class ImageTargetCompletionProvider {
  constructor (private readonly asciidocLoader: AsciidocLoader) {
  }

  async provideCompletionItems (textDocument: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
    const before = textDocument.getText(new vscode.Range(
      position.line,
      0,
      position.line,
      position.character
    ))
    const matches = [...before.matchAll(imageMacroRx)]
    if (matches) {
      const lastMatch = matches[matches.length - 1]
      const value = lastMatch[0]
      const macroEndCharacterPosition = lastMatch.index + value.length
      let currentTarget = before.slice(macroEndCharacterPosition, before.length)
      const asciidoctorDocument = await this.asciidocLoader.load(textDocument)
      const imageDirectory = asciidoctorDocument.getAttribute('imagesdir', '')
      const attributes = asciidoctorDocument.getAttributes()
      currentTarget = currentTarget.replace(attributeReferenceRx, (match, backslashes, attr) => {
        const replacement = replaceAttributeReference(match, backslashes, attr, attributes)
        return replacement === null ? match : replacement
      })
      // remote URL, cannot provide autocompletion
      if (currentTarget.startsWith('http://') || currentTarget.startsWith('https://')) {
        return []
      }
      // QUESTION: what about Windows path using \ as a separator?
      // can we safely detect a Windows path and replace \ by /?
      const parentDirectoryPath = currentTarget.slice(0, currentTarget.lastIndexOf('/'))
      const documentPath = textDocument.uri.path
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(textDocument.uri)
      if (workspaceFolder) {
        const workspacePath = workspaceFolder.uri.path
        const documentPathWorkspaceRelative = documentPath.replace(`${workspacePath}/`, '')
        let documentParentPath = documentPathWorkspaceRelative.slice(0, documentPathWorkspaceRelative.lastIndexOf('/'))
        if (imageDirectory) {
          documentParentPath = posix.join(documentParentPath, imageDirectory)
        }
        const currentDirectoryPath = posix.normalize(posix.join(documentParentPath, parentDirectoryPath))
        const glob = posix.join(currentDirectoryPath, '**')
        const levelUpCompletionItem: vscode.CompletionItem = {
          label: '..',
          kind: vscode.CompletionItemKind.Folder,
          sortText: '10_..',
        }
        const files = await vscode.workspace.findFiles(glob)
        const targets = files.map((f) => {
          try {
            return new TargetInfo(f, workspaceFolder, currentDirectoryPath)
          } catch (err) {
            console.error(`Unable to stat: ${f}, ignoring.`, err)
            return undefined
          }
        }).filter((t) => t) // ignore undefined
        return [
          levelUpCompletionItem,
          ...targets.map((t) => createPathCompletionItem(t)).filter((c) => c),
        ]
      }
      return []
    }
    return []
  }
}

function createPathCompletionItem (targetInfo: TargetInfo): vscode.CompletionItem | undefined {
  if (imageFileExtensions.has(targetInfo.fileExtension)) {
    const order = `1${targetInfo.pathSegments.length}`
    return {
      label: targetInfo.relativePath,
      kind: vscode.CompletionItemKind.File,
      sortText: `${order}_${targetInfo.lastSegment}_${targetInfo.relativePath}`,
      insertText: targetInfo.relativePath + '[]',
      filterText: targetInfo.lastSegment + ' ' + targetInfo.relativePath,
    }
  }
  // should we ignore other files?
  return undefined
}

function replaceAttributeReference (match, backslashes, attr, attributes) {
  let value
  if (backslashes) {
    const numBackslashes = backslashes.length
    const numResolvedBackslashes = Math.floor(numBackslashes / 2)
    value = match.slice(numBackslashes)
    if (attr in attributes) {
      value = attributes[attr]
    }
    return numResolvedBackslashes ? backslashes.slice(0, numResolvedBackslashes) + value : value
  }
  if (attr in attributes) {
    return attributes[attr]
  }
}

class TargetInfo {
  path: string
  relativePath: string
  lastSegment: string
  pathSegments: string[]
  fileExtension: string

  constructor (uri: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder, currentDirectoryPath: string) {
    this.path = uri.path
    this.relativePath = uri.path.replace(workspaceFolder.uri.path + '/' + currentDirectoryPath, '')
    this.pathSegments = uri.path.split('/')
    this.lastSegment = this.pathSegments[this.pathSegments.length - 1]
    this.fileExtension = this.lastSegment.slice(this.lastSegment.lastIndexOf('.'), this.lastSegment.length).toLowerCase()
  }
}
