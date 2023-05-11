import {
   createConnection,
   TextDocuments,
   Diagnostic,
   DiagnosticSeverity,
   InitializeParams,
   CompletionItem,
   CompletionItemKind,
   TextDocumentPositionParams,
} from "vscode-languageserver/node"

import { TextDocument } from "vscode-languageserver-textdocument"

const connection = createConnection()

connection.onInitialize((params: InitializeParams) => {
   return {
      capabilities: {},
   }
})

connection.onInitialized(() => {
   connection.console.log("Connection has been initialized 🦄.")
})

// ------------------------------ Document handling --------------------------------

const documents = new TextDocuments(TextDocument)
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)
// Called when the document is opened, and every time it is modifed.
documents.onDidChangeContent((change) => {
   validateTextDocument(change.document)
})

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
   // The validator creates diagnostics for all uppercase words length 2 and more
   const text = textDocument.getText()
   const pattern = /\b[A-Z]{2,}\b/g
   let m: RegExpExecArray | null

   const diagnostics: Diagnostic[] = []
   while ((m = pattern.exec(text))) {
      const diagnostic: Diagnostic = {
         severity: DiagnosticSeverity.Warning,
         range: {
            start: textDocument.positionAt(m.index),
            end: textDocument.positionAt(m.index + m[0].length),
         },
         message: `${m[0]} is all uppercase.`,
         source: "ex",
      }
      diagnostic.relatedInformation = [
         {
            location: {
               uri: textDocument.uri,
               range: Object.assign({}, diagnostic.range),
            },
            message: "Spelling matters",
         },
         {
            location: {
               uri: textDocument.uri,
               range: Object.assign({}, diagnostic.range),
            },
            message: "Particularly for names",
         },
      ]
      diagnostics.push(diagnostic)
   }

   // Send the computed diagnostics to VSCode.
   connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
}

// ------------------------------ Example functionality ---------------------------------

// Provide a list of completion items at the given position.
connection.onCompletion((pos: TextDocumentPositionParams): CompletionItem[] => {
   return [
      {
         label: "TypeScript",
         kind: CompletionItemKind.Text,
         data: 1,
      },
      {
         label: "JavaScript",
         kind: CompletionItemKind.Text,
         data: 2,
      },
   ]
})

// Provide additional information for the selected completion item.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
   if (item.data === 1) {
      item.detail = "TypeScript details"
      item.documentation = "TypeScript documentation"
   } else if (item.data === 2) {
      item.detail = "JavaScript details"
      item.documentation = "JavaScript documentation"
   }
   return item
})

// Begin listening for messages.
connection.listen()
