import { Position, Range } from 'vscode'
import ospath from 'path'

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
  readonly kind: CompletionContextKind;

  readonly target: string;

  readonly macroNameRange: Range;

  readonly attributeListStartPosition?: Position;

  readonly attributeListEndPosition?: Position;
}

export class PathCompletionProvider {
  async provideCompletionItems (pathCompletionContext: PathCompletionContext) {
    const supportedExtensions = getSupportedExtensions(pathCompletionContext.kind)
    const targetInfo = ospath.parse(pathCompletionContext.target)
    const parentDir = targetInfo.dir || '.'
    console.log({
      parentDir,
      supportedExtensions,
    })
    return []
  }
}

const pathCompletionRx = /(?<macro>image|link|xref|video|audio)::?(?<target>[^[\]\s:][^[\]]*)$/
const attributeListStartRx = /[^[\]\s]*(?<!\\)\[/

export function getPathCompletionContext (lineText: string, position: Position): PathCompletionContext | undefined {
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
        'au', // audio/basic RFC 2046
        'snd', // audio/basic
        'mid', // audio/mid
        'rmi', // audio/mid
        'mp3', // audio/mpeg RFC 3003
        'mp4', // audio/mp4
        'aif', // audio/x-aiff
        'aifc', // audio/x-aiff
        'aiff', // audio/x-aiff
        'm3u', // audio/x-mpegurl
        'ra', // audio/vnd.rn-realaudio
        'ram', // audio/vnd.rn-realaudio
        'ogg', // audio/ogg RFC 5334
        'wav', // audio/vnd.wav
      ]
    case CompletionContextKind.Image:
      return []
  }
  return []
}
