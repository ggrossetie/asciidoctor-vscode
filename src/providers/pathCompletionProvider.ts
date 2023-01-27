import { CompletionItemProvider } from 'vscode'

enum CompletionContextKind {
  /** `link:target[]` */
  Link,

  /** `xref::target.adoc#id[]` */
  Xref,

  /** `include::target.ext[]` */
  Include,

  /**
   * - `image::target.ext[]`
   * - `image:target.ext[]` (inline)
   */
  Image,

  /** `video::target.ext[]` */
  Video,

  /** `audio::target.ext[] */
  Audio,
}

interface PathCompletionContext {
  readonly kind: CompletionContextKind;
}

class PathCompletionProvider {
  provideCompletionItems (pathCompletionContext: PathCompletionContext) {
    const supportedExtensions = getSupportedExtensions(pathCompletionContext.kind)

  }
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
