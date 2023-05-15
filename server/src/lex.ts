import { Range, Diagnostic, DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver/node"

// The lexer is implemented by a single regex. The regex is used to construct a stream of tokens.
// The stream is used to construct a token tree, by counting the tabs at the start of each line.

// The regex can be visualized on the following website: https://regex101.com (choose JS in sidebar)
let regex = /(?<whitespace>\s+)|(?<word>\p{XID_Start}\p{XID_Continue}*)|(?<integer>[0-9]+)/dgu
type TokenType = "whitespace" | "word" | "integer"
// The "gud" suffix on the regex means the following:
//   "g" means global search, i.e. successive calls to exec() search further along the string.
//   "u" means Unicode support, which is necessary when using the XID character classes.
//   "d" means return the start and end indices of each match. I need this info.

class Token {}

export class Word extends Token {
   text: string
   constructor(text: string) {
      super()
      this.text = text
   }
   toString() {
      return this.text
   }
}

export class Integer extends Token {
   value: number
   constructor(value: number) {
      super()
      this.value = value
   }
   toString() {
      return this.value.toString()
   }
}

export class ASTNode {
   row: Token[] = []
   children: ASTNode[] = []

   show(): string {
      return this.showIndented(0)
   }
   showIndented(indent: number) {
      // Indent the row.
      let result = "\t".repeat(indent)
      // Print the row.
      let firstItem = true
      for (let token of this.row) {
         if (!firstItem) result += " "
         result += "[" + token + "]"
         firstItem = false
      }
      result += "\n"
      // Print the children.
      for (let child of this.children) {
         result += child.showIndented(indent + 1)
      }
      return result
   }
}

export class AST {
   rootNodes: ASTNode[] = []
   show(): string {
      return this.rootNodes.map((node) => node.show()).join("")
   }
}

export function lex(program: string): { ast: AST; diagnostics: Diagnostic[] } {
   // Info that persists across lines.
   let lineNumber = -1
   let ast = new AST()
   let pathBeingConstructed: ASTNode[] = [] // Path to the current node
   let ignoreLinesUntilIndent: number | false = false // For skipping over lines due to an indentation error
   let diagnostics: Diagnostic[] = []

   function flattenPathToLength(length: number) {
      while (pathBeingConstructed.length > length) {
         let node = pathBeingConstructed.pop() as ASTNode
         if (pathBeingConstructed.length > 0) {
            pathBeingConstructed.at(-1)!.children.push(node)
         } else {
            ast.rootNodes.push(node)
         }
      }
   }

   for (let line of program.split(/\r?\n/)) {
      // Update persistent state to accommodate the new line.
      ++lineNumber
      regex.lastIndex = 0 // ensure the regex searches from the start of the line

      // Initialize line state.
      let nodeBeingConstructed = new ASTNode()
      let leadingWhitespace = ""
      let lineContainsUnrecognizedCharacters = false
      // Initalize token state. (This will change after every call to getToken().)
      let tokenText = ""
      let tokenType: TokenType = "whitespace"
      let tokenRange: [number, number] = [0, 0]

      // Consume all the tokens on the line.
      let firstToken = true
      while (getToken()) {
         tokenType = tokenType as TokenType // hack to stop TypeScript from incorrectly narrowing
         if (tokenType === "whitespace") {
            if (firstToken) {
               // Record the leading whitespace — we'll consider it later.
               leadingWhitespace = tokenText
            } else {
               // Whitespace should be normalized by a code formatter (instead of causing a warning)
               //
               // if (/* last token of the line */ regex.lastIndex === line.length) {
               //    diagnostics.push({
               //       range: rangeOnCurrentLine(...tokenRange),
               //       severity: DiagnosticSeverity.Warning,
               //       message: "Trailing whitespace.",
               //    })
               // } else if (tokenText !== " ") {
               //    diagnostics.push({
               //       range: rangeOnCurrentLine(...tokenRange),
               //       severity: DiagnosticSeverity.Warning,
               //       message: "Words should be separated using a single space.",
               //    })
               // }
            }
         } else {
            let token: Token
            if (tokenType === "word") {
               token = new Word(tokenText)
            } else {
               token = new Integer(Number(tokenText))
            }
            nodeBeingConstructed.row.push(token)
         }
         // End loop
         firstToken = false
      }
      // We're at the end of the line. Check for errors.
      let lineIndent = leadingWhitespace.length
      let errorOnThisLine: boolean
      if (Array.from(leadingWhitespace).every((char) => char === "\t")) {
         // An earlier line may have triggered an "ignore" state. Reset it if appropriate.
         if (ignoreLinesUntilIndent !== false && lineIndent <= ignoreLinesUntilIndent) {
            ignoreLinesUntilIndent = false
         }
         if (ignoreLinesUntilIndent === false) {
            // Treat over-indented lines as erroneous, unless the line is pure whitespace.
            errorOnThisLine =
               lineIndent > pathBeingConstructed.length && nodeBeingConstructed.row.length > 0
            if (errorOnThisLine) {
               diagnostics.push({
                  range: rangeOnCurrentLine(0, leadingWhitespace.length),
                  severity: DiagnosticSeverity.Error,
                  message: "This line is indented too far.",
               })
               ignoreLinesUntilIndent = pathBeingConstructed.length
            }
         } else {
            // The correct level of indentation is not clear here, so any level is acceptable.
            errorOnThisLine = false
         }
      } else {
         // The leading whitespace contains non-tab characters.
         errorOnThisLine = true
         diagnostics.push({
            range: rangeOnCurrentLine(0, leadingWhitespace.length),
            severity: DiagnosticSeverity.Error,
            message:
               "Spaces are not permitted at beginning of a line. To indent a line, you must use tabs.",
         })
         // It is no longer clear what the current indentation level is, so we must ignore
         // all lines until the indentation returns to zero.
         ignoreLinesUntilIndent = 0
      }
      // Also consider whether getToken() encountered any unrecognized characters.
      if (lineContainsUnrecognizedCharacters) {
         errorOnThisLine = true
      }
      if (errorOnThisLine) {
         // Ignore this line.
         diagnostics.push({
            range: rangeOnCurrentLine(0, line.length),
            severity: DiagnosticSeverity.Hint, // This turns off squiggly underlines in VSCode.
            tags: [DiagnosticTag.Unnecessary],
            message: "This line will not be evaluated.",
         })
      } else {
         if (ignoreLinesUntilIndent !== false) {
            // Ignore this line, due to an error on a PREVIOUS line.
            diagnostics.push({
               range: rangeOnCurrentLine(0, line.length),
               severity: DiagnosticSeverity.Hint, // This turns off squiggly underlines in VSCode.
               tags: [DiagnosticTag.Unnecessary],
               message: "This line will not be evaluated, due to an error on a previous line.",
            })
         } else {
            // Add this line to the AST.
            // First, collapse the path to match the indentation level of this line.
            flattenPathToLength(lineIndent)
            // Then, add the new node to the path. Ignore lines that are purely whitespace.
            if (nodeBeingConstructed.row.length > 0) {
               pathBeingConstructed.push(nodeBeingConstructed)
            }
         }
      }
      // This function handles the "generic" lexing work:
      //   - Using the regex to retrieve the next token.
      //   - Reporting unrecognized characters.
      function getToken(): boolean {
         let match = regex.exec(line)
         let expectedRangeStart = tokenRange[1]
         let rangeStart: number
         if (match) {
            tokenText = match[0]
            // Set the first group whose value is not "undefined" as the token type.
            // (There should only be one such group.)
            for (let [key, value] of Object.entries(match.groups!)) {
               if (value) {
                  tokenType = key as TokenType
                  break
               }
            }
            tokenRange = (match as any).indices[0]
            rangeStart = tokenRange[0]
         } else {
            rangeStart = line.length
         }
         if (rangeStart !== expectedRangeStart) {
            // Characters have been skipped.
            let numCharacters = rangeStart - expectedRangeStart
            diagnostics.push({
               range: rangeOnCurrentLine(expectedRangeStart, rangeStart),
               severity: DiagnosticSeverity.Error,
               message: numCharacters > 1 ? "Unrecognized characters." : "Unrecognized character.",
            })
            lineContainsUnrecognizedCharacters = true
         }
         return match !== null
      }
      // This function returns a range (on the current line) in the LSP format.
      function rangeOnCurrentLine(start: number, end: number): Range {
         return {
            start: { line: lineNumber, character: start },
            end: { line: lineNumber, character: end },
         }
      }
   }
   // All lines have been processed.
   flattenPathToLength(0)

   return { ast, diagnostics }
}
