import { CompletionContext, CompletionItem, CompletionItemKind, FileSystemError, FileType, Position, Range, Uri, workspace } from 'vscode'
import ospath, { dirname, resolve } from 'path'
import { URI, Utils } from 'vscode-uri'

const pathCompletionRx = /(?<macro>image|link|xref|video|audio|include)::?(?<target>[^[\]\s:][^[\]]*|)$/
const attributeListStartRx = /[^[\]\s]*(?<!\\)\[/

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

  readonly context: CompletionContext

  readonly position: Position

  readonly kind: CompletionContextKind

  target: string

  readonly macroNameRange: Range

  readonly attributeListStartPosition?: Position

  readonly attributeListEndPosition?: Position

  baseDir?: string
}

export class PathCompletionProvider {
  async provideCompletionItems (documentUri: Uri, pathCompletionContext: PathCompletionContext): Promise<CompletionItem[]> {
    const supportedExtensions = getSupportedExtensions(pathCompletionContext.kind)
    const ref = getReference(pathCompletionContext.target, pathCompletionContext.baseDir)
    const parentDir = resolveReference(documentUri, ref)
    if (!parentDir) {
      return []
    }
    try {
      const files = await workspace.fs.readDirectory(parentDir)
      const levelUpCompletionItem: CompletionItem = {
        label: '../',
        kind: CompletionItemKind.Folder,
        sortText: '03_..',
        command: {
          command: 'editor.action.triggerSuggest',
          title: '',
        },
      }
      const completionItems = files
        .filter(([name, type]) => type !== FileType.File || !supportedExtensions || (type === FileType.File && supportedExtensions.includes(ospath.extname(name).toLowerCase())))
        .map(([name, type]) => {
          const isDir = type === FileType.Directory
          const newText = name + (isDir ? '/' : '')
          const label = isDir ? name + '/' : name
          const attributeListStartPosition = pathCompletionContext.attributeListStartPosition
          const sortOrder = getSortOrder(type, label)
          return {
            label,
            sortText: `0${sortOrder}_${label}`,
            kind: isDir ? CompletionItemKind.Folder : CompletionItemKind.File,
            insertText: isDir || (type === FileType.File && attributeListStartPosition) ? newText : `${newText}[]`,
            range: {
              inserting: new Range(pathCompletionContext.position, pathCompletionContext.position),
              replacing: type === FileType.File && attributeListStartPosition
                ? new Range(pathCompletionContext.position, attributeListStartPosition.with({ character: attributeListStartPosition.character - 1 }))
                : new Range(pathCompletionContext.position, pathCompletionContext.position),
            },
            command: isDir
              ? {
                command: 'editor.action.triggerSuggest',
                title: '',
              }
              : undefined,
          }
        })
      return [
        levelUpCompletionItem,
        ...completionItems,
      ]
    } catch (err) {
      if (err && err instanceof FileSystemError) {
        return []
      }
      throw err
    }
  }
}

/**
 * Get sort order:
 * 1. files
 * 2. directories
 * 3. ../
 * 4. hidden files
 * 5. hidden directories
 *
 * @param type file type
 * @param label file name
 */
function getSortOrder (type: FileType, label: string) {
  if (type === FileType.Directory) {
    if (label.startsWith('.')) {
      return 5 // hidden directories
    }
    return 2 // directories
  }
  if (label.startsWith('.')) {
    return 4 // hidden files
  }
  return 1 // files
}

export function resolveReference (documentUri: URI, ref: string): URI | undefined {
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

export function getReference (target: string, baseDir?: string): string {
  const path = baseDir
    ? ospath.join(baseDir.endsWith(ospath.posix.sep) ? baseDir : `${baseDir}${ospath.posix.sep}`, target)
    : target
  const targetInfo = ospath.parse(ospath.normalize(path))
  const dir = targetInfo.dir || '.'
  if (path.endsWith(ospath.posix.sep)) {
    return ospath.join(dir, targetInfo.base)
  }
  return dir
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
    return undefined
  }
}

export function getPathCompletionContext (lineText: string, position: Position, completionContext: CompletionContext): PathCompletionContext | undefined {
  const before = lineText.substring(0, position.character)
  const after = lineText.substring(position.character, lineText.length)
  const macroFound = before.match(pathCompletionRx)
  if (macroFound) {
    let macroNameRange
    const macro = macroFound.groups.macro
    if (macroFound.index === 0) {
      // block
      macroNameRange = new Range(position.line, 0, position.line, macro.length + 2)
    } else {
      // inline
      macroNameRange = new Range(position.line, macroFound.index, position.line, macroFound.index + macro.length + 1)
    }
    const kind = macro as CompletionContextKind
    const attributeListFound = after.match(attributeListStartRx)
    let attributeListStartPosition
    if (attributeListFound) {
      attributeListStartPosition = new Position(position.line, position.character + attributeListFound[0].length)
    }
    return {
      context: completionContext,
      position,
      kind,
      target: macroFound.groups.target || '',
      macroNameRange,
      attributeListStartPosition,
    }
  }
  return undefined
}

function getSupportedExtensions (completionContextKind: CompletionContextKind): string[] {
  switch (completionContextKind) {
    case CompletionContextKind.Include:
      // QUESTION: exclude all non text-based file extensions?
      return undefined
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
