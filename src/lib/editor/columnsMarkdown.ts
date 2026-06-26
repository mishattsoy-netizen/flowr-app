export function parseColumnFences(lines: string[], startIndex: number) {
  if (lines[startIndex] !== '::: columns') return null;
  
  const columnContents: string[][] = [];
  let currentColumn: string[] | null = null;
  let endIndex = startIndex + 1;
  let hasNestedError = false;

  while (endIndex < lines.length) {
    const line = lines[endIndex];
    
    if (line === '::::') {
      if (currentColumn !== null) {
        // Unclosed column before group closes
        columnContents.push(currentColumn);
      }
      break;
    }
    
    if (line === '::: columns') {
      hasNestedError = true;
      break;
    }
    
    if (line === '::: column') {
      if (currentColumn !== null) {
        columnContents.push(currentColumn);
      }
      currentColumn = [];
    } else if (line === ':::') {
      if (currentColumn !== null) {
        columnContents.push(currentColumn);
        currentColumn = null;
      }
    } else if (currentColumn !== null) {
      currentColumn.push(line);
    }
    
    endIndex++;
  }

  if (hasNestedError || endIndex >= lines.length || lines[endIndex] !== '::::') {
    return null;
  }

  return { columnContents, endIndex };
}

export function serializeColumns(columnBlocksMarkdown: string[]): string {
  let md = '::: columns\n';
  for (const col of columnBlocksMarkdown) {
    md += '::: column\n' + col + '\n:::\n';
  }
  md += '::::';
  return md;
}
