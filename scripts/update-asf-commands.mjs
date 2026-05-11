import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://github.com/JustArchiNET/ArchiSteamFarm/wiki/Commands-zh-CN';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputFile = path.join(repoRoot, 'src', 'modules', 'steam', 'asfCommands.generated.ts');

const fallbackTable = `<table class="hclonely" role="table"><thead><tr><th>命令</th><th>权限</th><th>描述</th><th>操作</th></tr></thead><tbody><tr><td><code>stats</code></td><td><code>Owner</code></td><td>显示 ASF 进程统计信息。</td><td><button type="button" class="rh-modal-button rh-asf-use" data-command="stats">使用</button></td></tr></tbody></table>`;

function escapeForTemplateLiteral(text) {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function toModuleSource(tableHtml) {
  return `export const ASF_COMMANDS_HTML = \`${escapeForTemplateLiteral(tableHtml)}\`;\n`;
}

function extractCommandsTable(html) {
  const headingMatch = html.match(/<h2[^>]*class="heading-element"[^>]*>\s*命令\s*<\/h2>/i);
  if (!headingMatch || headingMatch.index === undefined) {
    throw new Error('Failed to locate 命令 heading block.');
  }

  const afterHeading = html.slice(headingMatch.index + headingMatch[0].length);
  const tableMatch = afterHeading.match(/<table[^>]*role="table"[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    throw new Error('Failed to locate commands table after 命令 heading.');
  }

  return tableMatch[0];
}

function ensureTableClassAndRole(tableHtml) {
  let result = tableHtml;
  if (/class=/i.test(result)) {
    result = result.replace(/<table\b([^>]*?)class=("|')([^"']*)(\2)([^>]*)>/i, (_, before, quote, classes, _q2, after) => {
      const set = new Set(classes.split(/\s+/).filter(Boolean));
      set.add('hclonely');
      return `<table${before}class=${quote}${[...set].join(' ')}${quote}${after}>`;
    });
  } else {
    result = result.replace(/<table\b([^>]*)>/i, '<table$1 class="hclonely">');
  }

  if (/\brole=/i.test(result)) {
    result = result.replace(/<table\b([^>]*?)\srole=("|')[^"']*(\2)([^>]*)>/i, '<table$1 role="table"$4>');
  } else {
    result = result.replace(/<table\b([^>]*)>/i, '<table$1 role="table">');
  }

  return result;
}

function appendActionColumn(tableHtml) {
  let result = tableHtml;
  result = result.replace(/<thead>([\s\S]*?)<\/thead>/i, (theadMatch, inner) => {
    const updated = inner.replace(/<tr>([\s\S]*?)<\/tr>/i, (trMatch, trInner) => {
      if (/<th[^>]*>\s*操作\s*<\/th>/i.test(trInner)) {
        return `<tr>${trInner}</tr>`;
      }
      return `<tr>${trInner}<th>操作</th></tr>`;
    });
    return `<thead>${updated}</thead>`;
  });

  result = result.replace(/<tbody>([\s\S]*?)<\/tbody>/i, (tbodyMatch, tbodyInner) => {
    const updatedRows = tbodyInner.replace(/<tr>([\s\S]*?)<\/tr>/gi, (rowMatch, rowInner) => {
      if (/rh-asf-use/.test(rowInner)) {
        return `<tr>${rowInner}</tr>`;
      }

      const firstCodeMatch = rowInner.match(/<td[^>]*>[\s\S]*?<code[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/td>/i);
      const command = firstCodeMatch ? firstCodeMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const actionCell = `<td><button type="button" class="rh-modal-button rh-asf-use" data-command="${command.replace(/"/g, '&quot;')}">使用</button></td>`;
      return `<tr>${rowInner}${actionCell}</tr>`;
    });
    return `<tbody>${updatedRows}</tbody>`;
  });

  return result;
}

async function writeGenerated(tableHtml) {
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, toModuleSource(tableHtml), 'utf8');
}

async function main() {
  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'RedeemHelper ASF commands generator'
      }
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const html = await response.text();
    const table = extractCommandsTable(html);
    const normalized = appendActionColumn(ensureTableClassAndRole(table));
    await writeGenerated(normalized);
    console.log(`Generated ASF commands snapshot: ${outputFile}`);
  } catch (error) {
    if (existsSync(outputFile)) {
      console.warn(`Warning: failed to update ASF commands from upstream; keeping existing snapshot. ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    await writeGenerated(fallbackTable);
    console.warn(`Warning: failed to fetch ASF commands; wrote minimal fallback snapshot. ${error instanceof Error ? error.message : String(error)}`);
  }
}

await main();
