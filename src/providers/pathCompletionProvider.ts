import { CompletionContext, CompletionItemKind, FileType, Position, Range, workspace } from 'vscode'
import ospath, { dirname, resolve } from 'path'
import { URI, Utils } from 'vscode-uri'

export enum CompletionContextKind {
  /** `link:target[]` */
  Link = 'link',

  /** `xref::target.adoc#id[]` */
  Xref = 'xref',

  /** `include::target.ext[]` */
  Include = 'include',

  /**
   * - `image::target.ext[]`
   * - `image:target.ext[]` (inline)
   */
  Image = 'image',

  /** `video::target.ext[]` */
  Video = 'video',

  /** `audio::target.ext[] */
  Audio = 'audio',
}

export interface PathCompletionContext {

  readonly context: CompletionContext;
  readonly kind: CompletionContextKind;

  readonly target: string;

  readonly macroNameRange: Range;

  readonly attributeListStartPosition?: Position;

  readonly attributeListEndPosition?: Position;
}

export class PathCompletionProvider {
  async provideCompletionItems (documentUri: URI, pathCompletionContext: PathCompletionContext) {
    const supportedExtensions = getSupportedExtensions(pathCompletionContext.kind)
    const targetInfo = ospath.parse(pathCompletionContext.target)
    const parentDir = resolveReference(documentUri, targetInfo.dir || '.')
    if (!parentDir) {
      return []
    }
    const files = await workspace.fs.readDirectory(parentDir)
    return files
      .filter(([name, type]) => (type === FileType.File && supportedExtensions.includes(ospath.extname(name).toLowerCase())) || type !== FileType.File)
      .map(([name, type]) => {
        const isDir = type === FileType.Directory
        const newText = name + (isDir ? '/' : '')
        return {
          label: isDir ? name + '/' : name,
          kind: isDir ? CompletionItemKind.Folder : CompletionItemKind.File,
          textEdit: {
            newText,
            //insert: insertRange, // until next path segment (i.e., /)
            //replace: replacementRange, // until attribute list start (or end of macro)
          },
          command: isDir
            ? {
              command: 'editor.action.triggerSuggest',
              title: '',
            }
            : undefined,
        }
      })
  }
}

function resolveReference (documentUri: URI, ref: string): URI | undefined {
  if (ref.startsWith('/')) {
    const workspaceFolder = getWorkspaceFolder(documentUri)
    if (workspaceFolder) {
      return Utils.joinPath(workspaceFolder, ref)
    } else {
      return resolvePath(documentUri, ref.slice(1))
    }
  }

  return resolvePath(documentUri, ref)
}

function getWorkspaceFolder (docUri: URI): URI | undefined {
  if (workspace.workspaceFolders.length === 0) {
    return undefined
  }

  // Find the longest match
  const possibleWorkspaces = workspace.workspaceFolders
    .filter((folder) =>
      folder.uri.scheme === docUri.scheme &&
      folder.uri.authority === docUri.authority &&
      (docUri.fsPath.startsWith(folder.uri.fsPath + '/') || docUri.fsPath.startsWith(folder.uri.fsPath + '\\')))
    .sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length)

  if (possibleWorkspaces.length) {
    return possibleWorkspaces[0].uri
  }

  // Default to first workspace
  // QUESTION: Does this make sense?
  return workspace.workspaceFolders[0].uri
}

function resolvePath (root: URI, ref: string): URI | undefined {
  try {
    if (root.scheme === 'file') {
      return URI.file(resolve(dirname(root.fsPath), ref))
    } else {
      return root.with({
        path: resolve(dirname(root.path), ref),
      })
    }
  } catch (err) {
    console.log({ err })
    return undefined
  }
}

const pathCompletionRx = /(?<macro>image|link|xref|video|audio)::?(?<target>[^[\]\s:][^[\]]*)$/
const attributeListStartRx = /[^[\]\s]*(?<!\\)\[/

export function getPathCompletionContext (lineText: string, position: Position, completionContext: CompletionContext): PathCompletionContext | undefined {
  const before = lineText.substring(0, position.character)
  const after = lineText.substring(position.character, lineText.length)
  const macroFound = before.match(pathCompletionRx)
  if (macroFound) {
    let macroNameRange
    if (macroFound.index === 0) {
      // block
      macroNameRange = new Range(position.line, 0, position.line, macroFound.groups.macro.length + 2)
    } else {
      // inline
      macroNameRange = new Range(position.line, macroFound.index, position.line, macroFound.index + macroFound.groups.macro.length + 1)
    }
    const kind = macroFound.groups.macro as CompletionContextKind
    const attributeListFound = after.match(attributeListStartRx)
    let attributeListStartPosition
    if (attributeListFound) {
      attributeListStartPosition = new Position(position.line, position.character + attributeListFound[0].length)
    }
    return {
      context: completionContext,
      kind,
      target: macroFound.groups.target,
      macroNameRange,
      attributeListStartPosition,
    }
  }
  return undefined
}

function getSupportedExtensions (completionContextKind: CompletionContextKind): string[] {
  switch (completionContextKind) {
    case CompletionContextKind.Audio:
      return [
        '.au', // audio/basic RFC 2046
        '.snd', // audio/basic
        '.mid', // audio/mid
        '.rmi', // audio/mid
        '.mp3', // audio/mpeg RFC 3003
        '.mp4', // audio/mp4
        '.aif', // audio/x-aiff
        '.aifc', // audio/x-aiff
        '.aiff', // audio/x-aiff
        '.m3u', // audio/x-mpegurl
        '.ra', // audio/vnd.rn-realaudio
        '.ram', // audio/vnd.rn-realaudio
        '.ogg', // audio/ogg RFC 5334
        '.wav', // audio/vnd.wav
      ]
    case CompletionContextKind.Image:
      return [
        '.apng', // image/apng
        '.avif', // image/avif
        '.gif', // image/gif
        '.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp', // image/gif
        '.png', // image/png
        '.svg', // image/svg
        '.webp', // image/webp
      ]
  }
  return []
}
