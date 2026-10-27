/** Precise insertion-shape guidance, shared by side-effect-free preflight and edit admission. */
export interface PreflightShapeDiagnostic {operation:number;nodeId?:string;path:string;message:string;[key:string]:unknown}
export function preflightShapeDiagnostics(input:unknown):PreflightShapeDiagnostic[] {
  if(!input||typeof input!=='object'||!Array.isArray((input as {operations?:unknown}).operations))return [];
  const operations=(input as {operations:unknown[]}).operations;
  const diagnostics:PreflightShapeDiagnostic[]=[];
  for(const [index,value]of operations.slice(0,40).entries()){
    if(!value||typeof value!=='object')continue;
    const operation=value as Record<string,unknown>;
    if(operation.op!=='insert')continue;
    const nodeId=typeof operation.nodeId==='string'?operation.nodeId.slice(0,160):undefined;
    const add=(field:string,message:string)=>diagnostics.push({operation:index,...(nodeId?{nodeId}:{}),path:`operations.${index}.${field}`,message});
    if(operation.kind==='element'&&(typeof operation.tag!=='string'||!operation.tag.trim()))add('tag','Element insertion requires tag: an exact registered native tag. Reading a tag does not unlock insertion. Raw insert does not add recipe seeds.');
    if(operation.kind==='component'){
      if(typeof operation.componentId!=='string'||!operation.componentId.trim())add('componentId','Component insertion requires componentId from the installed catalog/contracts.');
      if(typeof operation.revision!=='string'||!operation.revision.trim())add('revision','Component insertion requires the exact installed revision. Raw insert does not add required slot content or recipe seeds.');
    }
    if(diagnostics.length>=8)break;
  }
  return diagnostics.slice(0,8);
}
