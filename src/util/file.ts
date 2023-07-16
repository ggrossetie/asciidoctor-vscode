/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode'
import * as ospath from 'path'
import * as fs from 'fs'
import { imageFileExtensions } from '../features/dropIntoEditor'

export function isAsciidocFile (document: vscode.TextDocument) {
  return document.languageId === 'asciidoc'
}

export class FileInfo {
  file: string
  isFile: boolean
  isImage: boolean
  private readonly fileExtension: string

  constructor (path: string, file: string) {
    this.file = file
    this.isFile = fs.statSync(ospath.join(path, file)).isFile()
    this.fileExtension = file.slice(file.lastIndexOf('.'), file.length).toLowerCase()
    this.isImage = imageFileExtensions.has(this.fileExtension)
  }
}

/**
 * @param parentDirectory  {string} parent directory (must be an absolute path)
 * @param target {string} text in the target string. e.g. './src/'
 */
export function getPathOfFolderToLookupFiles (parentDirectory: string, target: string): string {
  const normalizedTarget = ospath.normalize(target || '')
  const isPathAbsolute = normalizedTarget.startsWith(ospath.sep)
  if (isPathAbsolute) {
    parentDirectory = ''
  }
  return ospath.join(parentDirectory, normalizedTarget)
}

export async function getChildrenOfPath (path: string) {
  try {
    const files: string[] = await new Promise((resolve, reject) => {
      fs.readdir(path, (err, files) => {
        if (err) {
          reject(err)
        } else {
          resolve(files)
        }
      })
    })
    return files.map((f) => new FileInfo(path, f))
  } catch (error) {
    return []
  }
}

export const sortFilesAndDirectories = (filesAndDirs: FileInfo[]): FileInfo[] => {
  const dirs = filesAndDirs.filter((f) => f.isFile !== true)
  const files = filesAndDirs.filter((f) => f.isFile === true)
  return [...dirs, ...files]
}
