import { maskSource } from './source.mjs';

// Lexical block and control-statement scopes. Positions are source offsets.
export function buildScopes(source, code = maskSource(source)) {
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

// An interval index also handles overlapping scopes in incomplete sketches.
export function createScopeLookup(scopes) {
  const ordered = scopes.map((scope, order) => ({scope, order}))
    .sort((a, b) => a.scope.start - b.scope.start || a.order - b.order);
  function build(from, to) {
    if (from >= to) return null;
    const middle = (from + to) >>> 1;
    const left = build(from, middle);
    const right = build(middle + 1, to);
    return {...ordered[middle], left, right,
      maxEnd: Math.max(ordered[middle].scope.end, left?.maxEnd ?? -Infinity, right?.maxEnd ?? -Infinity)};
  }
  const root = build(0, ordered.length);
  return offset => {
    const matches = [];
    function visit(node) {
      if (!node || node.maxEnd <= offset) return;
      visit(node.left);
      if (node.scope.start > offset) return;
      if (offset < node.scope.end) matches.push(node);
      visit(node.right);
    }
    visit(root);
    return matches.sort((a, b) => (a.scope.end - a.scope.start) -
      (b.scope.end - b.scope.start) || a.order - b.order).map(node => node.scope);
  };
}

export function createVariableLookup(declarations, scopesAt) {
  const buckets = new Map();
  for (const item of declarations) {
    if (!item.scope) continue;
    if (!buckets.has(item.scope)) buckets.set(item.scope, []);
    buckets.get(item.scope).push(item);
  }
  for (const items of buckets.values()) items.sort((a,b) => b.offset-a.offset);
  scopesAt ??= createScopeLookup([...buckets.keys()]);
  return offset => {
    // Merge the active scopes in shadowing order without sorting all visible
    // declarations. The heap preserves offset ordering for tied scope spans.
    const heap = [];
    const before = (a,b) => a.span < b.span ||
      (a.span === b.span && a.items[a.index].offset > b.items[b.index].offset);
    function push(entry) {
      let index = heap.length;
      heap.push(entry);
      while (index > 0) {
        const parent = (index-1) >>> 1;
        if (!before(entry, heap[parent])) break;
        heap[index] = heap[parent];
        index = parent;
      }
      heap[index] = entry;
    }
    function pop() {
      const first = heap[0];
      const last = heap.pop();
      if (heap.length) {
        let index = 0;
        while (index*2+1 < heap.length) {
          let child = index*2+1;
          if (child+1 < heap.length && before(heap[child+1], heap[child])) child++;
          if (!before(heap[child], last)) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = last;
      }
      return first;
    }
    for (const scope of scopesAt(offset)) {
      const items = buckets.get(scope);
      if (!items) continue;
      let from = 0, to = items.length;
      while (from < to) {
        const middle = (from+to) >>> 1;
        if (items[middle].end > offset) from = middle+1;
        else to = middle;
      }
      if (from < items.length) push({items, index:from, span:scope.end-scope.start});
    }
    const names = [], seen = new Set();
    while (heap.length) {
      const entry = pop();
      const item = entry.items[entry.index++];
      if (!seen.has(item.name)) { seen.add(item.name); names.push(item.name); }
      if (entry.index < entry.items.length) push(entry);
    }
    return names;
  };
}

// Convenience API; repeated editor requests use createVariableLookup directly.
export function visibleVariables(declarations, offset) {
  return createVariableLookup(declarations)(offset);
}

