declare module '@n8n/workflow-sdk' {
  export function workflow(id: string, name: string): any;
  export function trigger(config: any): any;
  export function node(config: any): any;
  export function languageModel(config: any): any;
  export function memory(config: any): any;
  export function tool(config: any): any;
  export function embeddings(config: any): any;
  export function outputParser(config: any): any;
  export function ifElse(config: any): any;
  export function switchCase(config: any): any;
  export function newCredential(name: string): any;
  export function expr(expression: string): any;
}
