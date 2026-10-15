import { maskSource } from './source.mjs';

// Lexical block and control-statement scopes. Positions are source offsets.
export function buildScopes(source) {
  const code=maskSource(source);
  const tokens=[...code.matchAll(/[A-Za-z_]\w*|[^\s]/g)].map(match=>({text:match[0],start:match.index,end:match.index+match[0].length}));
  const pairs=new Map();
  const stack=[];
  const matching={')':'(',']':'[','}':'{'};
  for (let index=0;index<tokens.length;index++) {
    const text=tokens[index].text;
    if (['(','[','{'].includes(text)) stack.push(index);
    else if (matching[text]) {
      const open=stack.at(-1);
      if (open!==undefined && tokens[open].text===matching[text]) {
        stack.pop();pairs.set(open,index);
      }
    }
  }
  const scopes=[{start:0,end:code.length+1,open:null}];
  for (let index=0;index<tokens.length;index++) {
    if (tokens[index].text!=='{') continue;
    const close=pairs.get(index);
    scopes.push({start:tokens[index].end,end:close===undefined ? code.length+1 : tokens[close].end,open:tokens[index].start});
  }
  function statementEnd(start, recursion=0) {
    if (start>=tokens.length || recursion>200) return tokens.length+1;
    const text=tokens[start].text;
    if (text==='{') return pairs.has(start) ? pairs.get(start)+1 : tokens.length+1;
    if (['if','for','while','switch','catch'].includes(text)) {
      const open=tokens[start+1]?.text==='constexpr' ? start+2 : start+1;
      const close=pairs.get(open);
      if (tokens[open]?.text!=='(' || close===undefined) return tokens.length+1;
      let end=statementEnd(close+1,recursion+1);
      if (text==='if' && tokens[end]?.text==='else') end=statementEnd(end+1,recursion+1);
      return end;
    }
    if (text==='do') {
      const end=statementEnd(start+1,recursion+1);
      if (tokens[end]?.text==='while' && tokens[end+1]?.text==='(') {
        const close=pairs.get(end+1);
        return close===undefined ? tokens.length+1 : close+1+(tokens[close+1]?.text===';' ? 1 : 0);
      }
      return end;
    }
    for (let index=start;index<tokens.length;index++) {
      if (tokens[index].text===';') return index+1;
      if (tokens[index].text==='}') return index;
      if (pairs.has(index)) index=pairs.get(index);
    }
    return tokens.length+1;
  }
  function endOffset(end) {
    return end>tokens.length ? code.length+1 : (tokens[end-1]?.end ?? code.length+1);
  }
  for (let index=0;index<tokens.length;index++) {
    if (!['for','if','while','switch','catch'].includes(tokens[index].text)) continue;
    const open=tokens[index+1]?.text==='constexpr' ? index+2 : index+1;
    if (tokens[open]?.text!=='(') continue;
    const close=pairs.get(open);
    const end=statementEnd(index);
    scopes.push({start:tokens[open].end,end:endOffset(end),open:undefined});
    // A declaration in an unbraced substatement must not escape into an else.
    if (close!==undefined && tokens[close+1] && tokens[close+1].text!=='{') {
      const bodyEnd=statementEnd(close+1);
      scopes.push({start:tokens[close+1].start,end:endOffset(bodyEnd),open:undefined});
    }
  }
  return scopes;
}

export function visibleVariables(declarations, offset) {
  const seen=new Set();
  return declarations.filter(item=>item.scope && item.end<=offset &&
    offset>=item.scope.start && offset<item.scope.end)
    .sort((a,b)=>(a.scope.end-a.scope.start)-(b.scope.end-b.scope.start) || b.offset-a.offset)
    .filter(item=> {
      if (seen.has(item.name)) return false;
      seen.add(item.name);return true;
    }).map(item=>item.name);
}

